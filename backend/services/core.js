import mongoose from 'mongoose';
import { Admin, Student, Round, CounsellingCycle, AuditEvent } from '../models/index.js';

export class ServiceError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
  }
}

export function requireCondition(condition, code, message, status) {
  if (!condition) throw new ServiceError(code, message, status);
}

export function id(value) {
  requireCondition(mongoose.isObjectIdOrHexString(value), 'INVALID_ID', 'A valid ObjectId is required', 400);
  return String(value);
}

export const same = (a, b) => String(a) === String(b);
export const plain = document => document?.toObject ? document.toObject() : document;

export async function get(Model, value, session) {
  const document = await Model.findById(id(value)).session(session);
  requireCondition(document, 'NOT_FOUND', `${Model.modelName} was not found`, 404);
  return document;
}

export async function admin(actor, session, allowSystem = false) {
  if (allowSystem && actor?.type === 'SYSTEM') return;
  requireCondition(actor?.type === 'Admin', 'FORBIDDEN', 'Administrator access required', 403);
  const account = await get(Admin, actor.id, session);
  requireCondition(account.status === 'ACTIVE' && ['SUPER_ADMIN', 'COUNSELLING_ADMIN'].includes(account.role), 'FORBIDDEN', 'An active counselling administrator is required', 403);
}

export async function owner(actor, studentId, session) {
  if (actor?.type === 'Admin') return admin(actor, session);
  requireCondition(actor?.type === 'Student' && same(actor.id, studentId), 'FORBIDDEN', 'This student record belongs to another account', 403);
  await get(Student, studentId, session);
}

export async function audit(session, actor, action, fields, requestId) {
  requireCondition(typeof requestId === 'string' && requestId.trim().length > 0 && requestId.length <= 100, 'INVALID_REQUEST_ID', 'A requestId of 1–100 characters is required', 400);
  await AuditEvent.create([{
    actorType: actor.type, ...(actor.type === 'SYSTEM' ? {} : { actor: actor.id }),
    action, requestId, ...fields,
  }], { session });
}

export function createContext({ clock = () => new Date(), checkpoint = async () => {} } = {}) {
  async function transaction(academicYear, operation) {
    requireCondition(Number.isInteger(academicYear) && academicYear >= 2000 && academicYear <= 2200, 'INVALID_YEAR', 'Invalid academic year', 400);
    try {
      await CounsellingCycle.updateOne({ academicYear }, { $setOnInsert: { academicYear, revision: 0, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true, timestamps: false });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    try {
      return await mongoose.connection.transaction(async session => {
        await CounsellingCycle.updateOne({ academicYear }, { $inc: { revision: 1 } }, { session });
        return operation(session, new Date(clock()));
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', maxCommitTimeMS: 10000 });
    } catch (error) {
      if (error.code === 11000) throw new ServiceError('DUPLICATE_RECORD', 'A unique student, round or seat record already exists');
      throw error;
    }
  }

  async function forRound(roundId, operation) {
    const initial = await get(Round, roundId);
    return transaction(initial.academicYear, async (session, now) => {
      const round = await get(Round, roundId, session);
      return operation(session, now, round);
    });
  }

  return { transaction, forRound, checkpoint };
}

export async function requireUnopenedYear(academicYear, session) {
  const started = await Round.exists({ academicYear, status: { $ne: 'DRAFT' } }).session(session);
  requireCondition(!started, 'YEAR_FROZEN', 'Student eligibility and capacities are frozen after counselling opens');
}
