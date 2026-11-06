import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Student, College, Branch, RuleSet, Round, SeatMatrix } from '../models/index.js';
import { admin, get, same, plain, requireCondition, requireUnopenedYear, audit } from './core.js';

export function createCatalogueService(context) {
  async function createStudent({ data, password, actor, requestId }) {
    const secret = password ?? randomBytes(24).toString('base64url');
    requireCondition(typeof secret === 'string' && secret.length >= 10 && Buffer.byteLength(secret) <= 72, 'INVALID_PASSWORD', 'Password must contain at least 10 characters and at most 72 bytes', 400);
    const passwordHash = await hash(secret, 10);
    requireCondition(!Object.hasOwn(data, 'passwordHash'), 'INVALID_INPUT', 'Supply password separately', 400);
    return context.transaction(data.academicYear, async session => {
      await admin(actor, session);
      await requireUnopenedYear(data.academicYear, session);
      requireCondition(!data.status || ['REGISTERED', 'ELIGIBLE'].includes(data.status), 'INVALID_STATUS', 'New students cannot hold an allocation', 400);
      const [student] = await Student.create([{ ...data, passwordHash }], { session });
      await audit(session, actor, 'STUDENT_CREATED', { student: student._id, summary: 'Student registered by administrator' }, requestId);
      return plain(student);
    });
  }

  async function verifyStudent({ studentId, verificationStatus, eligibilityGroups, actor, requestId }) {
    const initial = await get(Student, studentId);
    return context.transaction(initial.academicYear, async session => {
      await admin(actor, session);
      await requireUnopenedYear(initial.academicYear, session);
      const student = await get(Student, studentId, session);
      student.verificationStatus = verificationStatus;
      student.eligibilityGroups = eligibilityGroups;
      student.status = verificationStatus === 'VERIFIED' ? 'ELIGIBLE' : 'REGISTERED';
      await student.save({ session });
      await audit(session, actor, 'VERIFICATION_CHANGED', { student: studentId, summary: 'Verification status updated' }, requestId);
      return plain(student);
    });
  }

  async function createCollege({ data, actor }) {
    await admin(actor);
    return plain(await College.create(data));
  }

  async function createBranch({ data, actor }) {
    await admin(actor);
    const college = await get(College, data.college);
    requireCondition(college.isActive, 'INACTIVE_COLLEGE', 'College is inactive');
    return plain(await Branch.create(data));
  }

  async function createRules({ data, actor, requestId }) {
    return context.transaction(data.academicYear, async session => {
      await admin(actor, session);
      const [rules] = await RuleSet.create([{ ...data, createdBy: actor.id }], { session });
      await audit(session, actor, 'CONFIGURATION_CHANGED', { academicYear: data.academicYear, summary: `Rule version ${rules.version} created` }, requestId);
      return plain(rules);
    });
  }

  async function configurePool({ data, actor, requestId }) {
    return context.transaction(data.academicYear, async session => {
      await admin(actor, session);
      await requireUnopenedYear(data.academicYear, session);
      const branch = await get(Branch, data.branch, session);
      const college = await get(College, data.college, session);
      requireCondition(same(branch.college, college._id) && branch.isActive && college.isActive, 'INVALID_CHOICE', 'Seat pool must reference an active college and its branch');
      requireCondition(!Object.hasOwn(data, 'availableSeats'), 'INVALID_INPUT', 'Set totalSeats only; vacancy is managed by the engine', 400);
      let pool = await SeatMatrix.findOne({ academicYear: data.academicYear, branch: branch._id, category: data.category }).session(session);
      pool ??= new SeatMatrix(data);
      pool.totalSeats = data.totalSeats;
      pool.availableSeats = data.totalSeats;
      await pool.save({ session });
      await audit(session, actor, 'CONFIGURATION_CHANGED', { academicYear: data.academicYear, summary: 'Seat pool capacity configured' }, requestId);
      return plain(pool);
    });
  }

  async function createRound({ data, actor, requestId }) {
    return context.transaction(data.academicYear, async session => {
      await admin(actor, session);
      const rules = await get(RuleSet, data.ruleSet, session);
      requireCondition(rules.academicYear === data.academicYear, 'YEAR_MISMATCH', 'Rules must belong to the round academic year');
      const [round] = await Round.create([{ ...data, managedBy: actor.id, status: 'DRAFT', publishedAt: undefined }], { session });
      await audit(session, actor, 'CONFIGURATION_CHANGED', { round: round._id, summary: 'Draft counselling round created' }, requestId);
      return plain(round);
    });
  }

  return { createStudent, verifyStudent, createCollege, createBranch, createRules, configurePool, createRound };
}
