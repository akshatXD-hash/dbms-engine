import mongoose from 'mongoose';
import { Student, College, Branch, SeatMatrix, Allocation, SeatHolding, RoundResult, Round, AuditEvent } from '../models/index.js';
import { HOLDING_STATUSES } from '../constants/domain.js';
import { admin, owner, get, plain, requireCondition } from './core.js';

export function createReportService() {
  async function result({ studentId, roundId, actor }) {
    await owner(actor, studentId);
    const round = await get(Round, roundId);
    requireCondition(round.status === 'PUBLISHED' || actor.type === 'Admin', 'RESULT_UNPUBLISHED', 'Round results are not published', 403);
    const document = await RoundResult.findOne({ student: studentId, round: roundId }).populate('allocation');
    requireCondition(document, 'NOT_FOUND', 'Round result was not found', 404);
    return plain(document);
  }

  async function history({ studentId, actor }) {
    await owner(actor, studentId);
    const published = await Round.find({ status: 'PUBLISHED' }).distinct('_id');
    const filter = { student: studentId, ...(actor.type === 'Admin' ? {} : { round: { $in: published } }) };
    return Allocation.find(filter).sort({ allocatedAt: 1 }).lean();
  }

  async function catalogue({ academicYear }) {
    requireCondition(Number.isInteger(academicYear), 'INVALID_YEAR', 'Academic year is required', 400);
    const colleges = await College.find({ isActive: true }).select('_id').lean();
    const branches = await Branch.find({ isActive: true, college: { $in: colleges.map(college => college._id) } }).select('_id').lean();
    return SeatMatrix.find({ academicYear, branch: { $in: branches.map(branch => branch._id) } }).populate('college branch').lean();
  }

  async function auditHistory({ academicYear, actor }) {
    await admin(actor);
    const rounds = await Round.find({ academicYear }).distinct('_id');
    const students = await Student.find({ academicYear }).distinct('_id');
    return AuditEvent.find({ $or: [{ academicYear }, { round: { $in: rounds } }, { student: { $in: students } }] }).sort({ occurredAt: 1 }).lean();
  }

  async function reconcile({ academicYear, actor }) {
    await admin(actor);
    return mongoose.connection.transaction(async session => {
      const pools = await SeatMatrix.find({ academicYear }).session(session).lean();
      const allocations = await Allocation.find({ academicYear, status: { $in: HOLDING_STATUSES } }).session(session).lean();
      const holdings = await SeatHolding.find({ academicYear }).session(session).lean();
      const counts = new Map();
      for (const allocation of allocations) counts.set(String(allocation.seatMatrix), (counts.get(String(allocation.seatMatrix)) ?? 0) + 1);
      const issues = [];
      const poolIds = new Set(pools.map(pool => String(pool._id)));
      for (const allocation of allocations) {
        if (!poolIds.has(String(allocation.seatMatrix))) issues.push({ type: 'MISSING_POOL', allocation: allocation._id });
        if (!holdings.some(holding => String(holding.allocation) === String(allocation._id) && String(holding.student) === String(allocation.student))) issues.push({ type: 'MISSING_HOLDING', allocation: allocation._id });
      }
      for (const holding of holdings) {
        if (!allocations.some(allocation => String(allocation._id) === String(holding.allocation) && String(allocation.student) === String(holding.student))) issues.push({ type: 'INVALID_HOLDING', holding: holding._id });
      }
      const capacities = pools.map(pool => {
        const held = counts.get(String(pool._id)) ?? 0;
        const expected = pool.totalSeats - held;
        if (pool.availableSeats !== expected) issues.push({ type: 'CAPACITY_MISMATCH', pool: pool._id, expected, actual: pool.availableSeats });
        return { pool: pool._id, total: pool.totalSeats, available: pool.availableSeats, held };
      });
      return { consistent: issues.length === 0, capacities, issues };
    }, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
  }

  return { result, history, catalogue, auditHistory, reconcile };
}
