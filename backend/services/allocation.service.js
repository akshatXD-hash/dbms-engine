import { Student, RuleSet, Preference, College, Branch, SeatMatrix, Allocation, SeatHolding, RoundResult, Round } from '../models/index.js';
import { HOLDING_STATUSES } from '../constants/domain.js';
import { admin, owner, get, same, plain, requireCondition, audit } from './core.js';

export function eligibleCategories(student, rules) {
  return rules.seatCategories.filter(rule =>
    rule.allowedStudentCategories.includes(student.category) &&
    (!rule.requiresVerification || student.verificationStatus === 'VERIFIED') &&
    rule.requiredEligibilityGroups.every(group => student.eligibilityGroups.includes(group)),
  ).map(rule => rule.category);
}

export function createAllocationService(context) {
  async function heldSeat(student, session) {
    const holding = await SeatHolding.findOne({ student: student._id, academicYear: student.academicYear }).session(session);
    if (!holding) return {};
    const allocation = await get(Allocation, holding.allocation, session);
    requireCondition(same(allocation.student, student._id) && allocation.academicYear === student.academicYear && HOLDING_STATUSES.includes(allocation.status), 'INCONSISTENT_HOLDING', 'Held seat does not match allocation history');
    return { holding, allocation };
  }

  async function selectSeat(student, round, preference, current, session) {
    if (!preference?.locked) return null;
    requireCondition(preference.academicYear === round.academicYear, 'YEAR_MISMATCH', 'Preference belongs to another academic year');
    const rules = await get(RuleSet, round.ruleSet, session);
    requireCondition(rules.academicYear === round.academicYear, 'YEAR_MISMATCH', 'Rule set belongs to another academic year');
    const categories = eligibleCategories(student, rules);
    let choices = preference.choices;
    if (current) {
      const oldPool = await get(SeatMatrix, current.seatMatrix, session);
      const oldPosition = choices.findIndex(choice => same(choice.branch, oldPool.branch));
      requireCondition(oldPosition >= 0, 'CURRENT_SEAT_REQUIRED', 'Locked list must contain the currently held branch');
      choices = choices.slice(0, oldPosition);
    }
    for (const choice of choices) {
      const branch = await get(Branch, choice.branch, session);
      const college = await get(College, choice.college, session);
      requireCondition(same(branch.college, college._id), 'INVALID_CHOICE', 'Preference branch does not belong to its college');
      if (!branch.isActive || !college.isActive) continue;
      for (const category of categories) {
        const pool = await SeatMatrix.findOne({ academicYear: round.academicYear, branch: branch._id, category, availableSeats: { $gt: 0 } }).session(session);
        if (!pool) continue;
        requireCondition(same(pool.college, college._id), 'INVALID_POOL', 'Seat pool college does not match the branch');
        return { pool, choice };
      }
    }
    return null;
  }

  async function processStudent({ studentId, roundId, proposedSeatMatrixId, actor, requestId }) {
    return context.forRound(roundId, async (session, now, round) => {
      await admin(actor, session, true);
      const student = await get(Student, studentId, session);
      requireCondition(student.academicYear === round.academicYear, 'YEAR_MISMATCH', 'Student belongs to another academic year');
      const priorResult = await RoundResult.findOne({ student: studentId, round: roundId }).session(session);
      if (priorResult) return plain(priorResult);
      requireCondition(round.status === 'PROCESSING' && now >= round.preferenceDeadline && now < round.endDate, 'ROUND_NOT_PROCESSING', 'Round is not accepting allocation work');
      requireCondition(student.status !== 'WITHDRAWN', 'WITHDRAWN', 'Withdrawn student cannot be processed');
      const processed = await RoundResult.distinct('student', { round: roundId }).session(session);
      const earlier = await Student.exists({ academicYear: round.academicYear, status: { $ne: 'WITHDRAWN' }, rank: { $lt: student.rank }, _id: { $nin: processed } }).session(session);
      requireCondition(!earlier, 'RANK_ORDER_REQUIRED', 'Process all higher-ranked students first');
      const preference = await Preference.findOne({ student: studentId, round: roundId }).session(session);
      const { holding, allocation: current } = await heldSeat(student, session);
      let selected = null;
      if (!current || current.status === 'UPGRADE_REQUESTED') {
        selected = await selectSeat(student, round, preference, current, session);
      }
      if (proposedSeatMatrixId !== undefined) {
        requireCondition(selected && same(selected.pool._id, proposedSeatMatrixId), 'STALE_DECISION', 'The proposed seat is no longer the best eligible available choice');
      }
      let allocation = current;
      let reason = current ? 'Previous seat retained' : 'No locked eligible preference with an available seat';
      if (selected) {
        const { pool, choice } = selected;
        if (current) {
          const previousRound = await get(Round, current.round, session);
          requireCondition(previousRound.roundNumber < round.roundNumber, 'INVALID_UPGRADE', 'Upgrades must be in a later round');
        }
        const changes = [{ id: pool._id, delta: -1 }];
        if (current) changes.push({ id: current.seatMatrix, delta: 1 });
        changes.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        for (const change of changes) {
          const condition = change.delta < 0 ? { availableSeats: { $gt: 0 } } : { $expr: { $lt: ['$availableSeats', '$totalSeats'] } };
          const update = await SeatMatrix.updateOne({ _id: change.id, academicYear: round.academicYear, ...condition }, { $inc: { availableSeats: change.delta } }, { session });
          requireCondition(update.modifiedCount === 1, 'SEAT_CONFLICT', 'Seat availability changed or is inconsistent');
          await context.checkpoint('seat-updated');
        }
        if (current) {
          current.status = 'UPGRADED';
          await current.save({ session });
        }
        [allocation] = await Allocation.create([{
          student: studentId, round: roundId, academicYear: round.academicYear,
          seatMatrix: pool._id, preference: preference._id, preferenceOrder: choice.preferenceOrder,
          rankSnapshot: student.rank, status: 'ALLOTTED', allocatedAt: now,
          ...(current ? { previousAllocation: current._id } : {}),
        }], { session });
        if (holding) {
          holding.allocation = allocation._id;
          await holding.save({ session });
        } else {
          await SeatHolding.create([{ student: studentId, academicYear: round.academicYear, allocation: allocation._id }], { session });
        }
        student.status = 'ALLOTTED';
        await student.save({ session });
        await context.checkpoint('allocation-created');
        reason = current ? 'Upgraded to a higher preference' : 'Best eligible available preference';
        await audit(session, actor, current ? 'SEAT_UPGRADED' : 'ALLOCATION_CREATED', { student: studentId, round: roundId, allocation: allocation._id, summary: reason }, requestId);
      }
      const [result] = await RoundResult.create([{
        student: studentId, round: roundId, academicYear: round.academicYear,
        outcome: allocation ? 'ALLOTTED' : 'UNALLOCATED',
        ...(allocation ? { allocation: allocation._id } : {}), reason, processedAt: now,
      }], { session });
      if (!selected) await audit(session, actor, 'ROUND_RESULT_RECORDED', { student: studentId, round: roundId, summary: reason }, requestId);
      await context.checkpoint('result-created');
      return plain(result);
    });
  }

  async function decide({ allocationId, roundId, action, actor, requestId }) {
    const targets = { ACCEPT: 'ACCEPTED', RELEASE: 'RELEASED', REQUEST_UPGRADE: 'UPGRADE_REQUESTED' };
    requireCondition(Object.hasOwn(targets, action), 'INVALID_ACTION', 'Choose ACCEPT, RELEASE or REQUEST_UPGRADE', 400);
    return context.forRound(roundId, async (session, now, round) => {
      const allocation = await get(Allocation, allocationId, session);
      await owner(actor, allocation.student, session);
      const result = await RoundResult.findOne({ student: allocation.student, round: roundId, allocation: allocationId }).session(session);
      requireCondition(result && allocation.academicYear === round.academicYear, 'INVALID_ALLOCATION', 'Allocation is not this student round result');
      if (allocation.status === targets[action]) return plain(allocation);
      requireCondition(round.status === 'PUBLISHED' && now < round.endDate, 'DECISION_WINDOW_CLOSED', 'Seat decisions are closed');
      const later = await Round.exists({ academicYear: round.academicYear, roundNumber: { $gt: round.roundNumber }, status: { $ne: 'DRAFT' } }).session(session);
      requireCondition(!later, 'DECISION_WINDOW_CLOSED', 'A later round has already opened');
      const student = await get(Student, allocation.student, session);
      const { holding, allocation: held } = await heldSeat(student, session);
      requireCondition(held && same(held._id, allocation._id), 'NOT_HELD', 'Student no longer holds this seat');
      if (action === 'RELEASE') {
        requireCondition(round.allowRelease, 'ACTION_DISABLED', 'Releases are disabled for this round');
        const update = await SeatMatrix.updateOne({ _id: allocation.seatMatrix, academicYear: round.academicYear, $expr: { $lt: ['$availableSeats', '$totalSeats'] } }, { $inc: { availableSeats: 1 } }, { session });
        requireCondition(update.modifiedCount === 1, 'INCONSISTENT_CAPACITY', 'Cannot return a seat to this pool');
        await SeatHolding.deleteOne({ _id: holding._id }, { session });
        student.status = student.verificationStatus === 'VERIFIED' ? 'ELIGIBLE' : 'REGISTERED';
      } else if (action === 'REQUEST_UPGRADE') {
        requireCondition(round.allowUpgrade, 'ACTION_DISABLED', 'Upgrades are disabled for this round');
        student.status = 'ALLOTTED';
      } else {
        student.status = 'ACCEPTED';
      }
      allocation.status = targets[action];
      await allocation.save({ session });
      await student.save({ session });
      await context.checkpoint('decision-saved');
      const event = { ACCEPT: 'SEAT_ACCEPTED', RELEASE: 'SEAT_RELEASED', REQUEST_UPGRADE: 'UPGRADE_REQUESTED' }[action];
      await audit(session, actor, event, { student: student._id, round: roundId, allocation: allocation._id, summary: `Student action: ${action}` }, requestId);
      return plain(allocation);
    });
  }

  return { processStudent, decide };
}
