import { Student, Round, RuleSet, RoundResult } from '../models/index.js';
import { admin, get, plain, requireCondition, audit } from './core.js';

export function createRoundService(context) {
  const transitions = { DRAFT: 'OPEN', OPEN: 'LOCKED', LOCKED: 'PROCESSING', PROCESSING: 'COMPLETED', COMPLETED: 'PUBLISHED' };
  async function transition({ roundId, status, actor, requestId }) {
    return context.forRound(roundId, async (session, now, round) => {
      await admin(actor, session);
      if (round.status === status) return plain(round);
      requireCondition(transitions[round.status] === status, 'INVALID_TRANSITION', 'Round transitions must follow DRAFT → OPEN → LOCKED → PROCESSING → COMPLETED → PUBLISHED');
      if (status === 'OPEN') {
        const laterStarted = await Round.exists({ academicYear: round.academicYear, roundNumber: { $gt: round.roundNumber }, status: { $ne: 'DRAFT' } }).session(session);
        requireCondition(!laterStarted, 'LATER_ROUND_STARTED', 'A later round has already started');
        requireCondition(now >= round.startDate && now < round.preferenceDeadline, 'ROUND_WINDOW_CLOSED', 'Round cannot open outside its preference window');
        const rules = await get(RuleSet, round.ruleSet, session);
        requireCondition(rules.academicYear === round.academicYear, 'YEAR_MISMATCH', 'Rule set belongs to another academic year');
        if (round.roundNumber > 1) {
          const previous = await Round.findOne({ academicYear: round.academicYear, roundNumber: round.roundNumber - 1 }).session(session);
          requireCondition(previous?.status === 'PUBLISHED' && now >= previous.endDate, 'PREVIOUS_ROUND_OPEN', 'Previous round must be published and its decision window closed');
        }
        const otherOpen = await Round.exists({ academicYear: round.academicYear, _id: { $ne: round._id }, status: { $in: ['OPEN', 'LOCKED', 'PROCESSING', 'COMPLETED'] } }).session(session);
        requireCondition(!otherOpen, 'ROUND_ALREADY_OPEN', 'Another round is active');
      }
      if (['LOCKED', 'PROCESSING'].includes(status)) {
        requireCondition(now >= round.preferenceDeadline && now < round.endDate, 'ROUND_WINDOW_CLOSED', 'Allocation must occur after the preference deadline and before round end');
      }
      if (['COMPLETED', 'PUBLISHED'].includes(status)) {
        const processed = await RoundResult.distinct('student', { round: roundId, outcome: { $in: ['ALLOTTED', 'UNALLOCATED'] } }).session(session);
        const missing = await Student.exists({ academicYear: round.academicYear, status: { $ne: 'WITHDRAWN' }, _id: { $nin: processed } }).session(session);
        const failed = await RoundResult.exists({ round: roundId, outcome: 'FAILED' }).session(session);
        requireCondition(!missing && !failed, 'ROUND_INCOMPLETE', 'Every participating student must have a successful round outcome');
      }
      round.status = status;
      if (status === 'PUBLISHED') round.publishedAt = now;
      await round.save({ session });
      await audit(session, actor, 'ROUND_STATUS_CHANGED', { round: roundId, summary: `Round changed to ${status}` }, requestId);
      return plain(round);
    });
  }
  return { transition };
}
