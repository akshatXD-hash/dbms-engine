import { Student, Preference, College, Branch, Allocation } from '../models/index.js';
import { HOLDING_STATUSES } from '../constants/domain.js';
import { get, owner, same, plain, requireCondition, audit } from './core.js';

export function createPreferenceService(context) {
  async function save({ studentId, roundId, choices, expectedVersion, actor, requestId }) {
    return context.forRound(roundId, async (session, now, round) => {
      await owner(actor, studentId, session);
      const student = await get(Student, studentId, session);
      requireCondition(student.academicYear === round.academicYear && student.status !== 'WITHDRAWN', 'INVALID_STUDENT', 'Student cannot participate in this round');
      requireCondition(round.status === 'OPEN' && now >= round.startDate && now < round.preferenceDeadline, 'PREFERENCE_WINDOW_CLOSED', 'Preference editing window is closed');
      let preference = await Preference.findOne({ student: studentId, round: roundId }).session(session);
      requireCondition(!preference?.locked, 'PREFERENCES_LOCKED', 'Locked preferences cannot be changed');
      requireCondition(preference ? expectedVersion === preference.__v : expectedVersion === undefined || expectedVersion === null, 'VERSION_CONFLICT', 'Reload the preference list before editing');
      requireCondition(Array.isArray(choices) && choices.length <= 1000, 'INVALID_CHOICES', 'Provide at most 1000 choices', 400);
      const normalized = [];
      for (const [index, choice] of choices.entries()) {
        const branch = await get(Branch, choice.branch, session);
        const college = await get(College, choice.college, session);
        requireCondition(same(branch.college, college._id) && branch.isActive && college.isActive, 'INVALID_CHOICE', 'Branch must belong to an active college');
        normalized.push({ college: college._id, branch: branch._id, preferenceOrder: index + 1 });
      }
      const held = await Allocation.findOne({ student: studentId, academicYear: round.academicYear, status: { $in: HOLDING_STATUSES } }).populate({ path: 'seatMatrix', options: { session } }).session(session);
      if (held) requireCondition(normalized.some(choice => same(choice.branch, held.seatMatrix.branch)), 'CURRENT_SEAT_REQUIRED', 'Include the currently held branch in the new preference list');
      preference ??= new Preference({ student: studentId, round: roundId, academicYear: round.academicYear });
      preference.choices = normalized;
      preference.submittedAt = now;
      await preference.save({ session });
      await audit(session, actor, 'PREFERENCES_SAVED', { student: studentId, round: roundId, summary: 'Ordered preferences saved' }, requestId);
      return plain(preference);
    });
  }

  async function lock({ studentId, roundId, actor, requestId }) {
    return context.forRound(roundId, async (session, now, round) => {
      await owner(actor, studentId, session);
      const preference = await Preference.findOne({ student: studentId, round: roundId }).session(session);
      requireCondition(preference, 'NOT_FOUND', 'Save preferences before locking', 404);
      if (preference.locked) return plain(preference);
      requireCondition(round.status === 'OPEN' && now >= round.startDate && now < round.preferenceDeadline, 'PREFERENCE_WINDOW_CLOSED', 'Preference locking window is closed');
      preference.locked = true;
      preference.lockedAt = now;
      await preference.save({ session });
      await audit(session, actor, 'PREFERENCES_LOCKED', { student: studentId, round: roundId, summary: 'Preference list locked' }, requestId);
      return plain(preference);
    });
  }

  return { save, lock };
}
