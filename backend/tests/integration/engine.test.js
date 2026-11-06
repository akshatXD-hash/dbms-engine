import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { connectDB, disconnectDB } from '../../config/db.js';
import { initializeDatabase } from '../../config/initialize-db.js';
import * as models from '../../models/index.js';
import { sampleData } from '../../fixtures/sample-data.js';
import { createDbmsEngine } from '../../services/index.js';
import { insertStudents } from '../../seeds/students.seed.js';

test('Atlas DBMS services preserve counselling invariants across three rounds', { timeout: 600000 }, async t => {
  const dbName = `counseldesk_test_${randomBytes(8).toString('hex')}`;
  let connection;
  try {
    connection = await connectDB({ ...globalThis.process.env, MONGODB_DB_NAME: dbName });
    await initializeDatabase();
    const data = sampleData();
    const admin = await models.Admin.create(data.Admin);
    const college = await models.College.create(data.College);
    const branchA = await models.Branch.create(data.Branch);
    const branchB = await models.Branch.create({ ...data.Branch, _id: new Types.ObjectId(), name: 'Electronics', programCode: 'ECE' });
    const rules = await models.RuleSet.create(data.RuleSet);
    const poolA = await models.SeatMatrix.create({ ...data.SeatMatrix, totalSeats: 1, availableSeats: 1 });
    const poolB = await models.SeatMatrix.create({ ...data.SeatMatrix, _id: new Types.ObjectId(), branch: branchB._id, totalSeats: 1, availableSeats: 1 });
    const students = [];
    for (let i = 1; i <= 3; i++) students.push(await models.Student.create({
      ...data.Student, _id: new Types.ObjectId(), applicationNumber: `TEST${i}`, email: `test${i}@example.test`, rank: i, status: 'ELIGIBLE',
    }));
    let now = new Date('2026-01-02T00:00:00Z');
    const engine = createDbmsEngine({ clock: () => now });
    const actor = { type: 'Admin', id: admin._id };
    const studentActor = i => ({ type: 'Student', id: students[i]._id });
    const request = label => `${label}-${randomBytes(4).toString('hex')}`;
    const choice = branch => ({ college: college._id, branch: branch._id });
    let round = await engine.catalogue.createRound({ actor, requestId: request('create'), data: {
      academicYear: 2026, roundNumber: 1, name: 'Round 1', ruleSet: rules._id,
      startDate: new Date('2026-01-01'), preferenceDeadline: new Date('2026-01-10'), endDate: new Date('2026-01-20'),
    } });
    const transition = status => engine.rounds.transition({ roundId: round._id, status, actor, requestId: request(status) });
    const save = (i, branches, extra = {}) => engine.preferences.save({ studentId: students[i]._id, roundId: round._id, choices: branches.map(choice), actor: studentActor(i), requestId: request('prefs'), ...extra });
    const lock = i => engine.preferences.lock({ studentId: students[i]._id, roundId: round._id, actor: studentActor(i), requestId: request('lock') });
    const process = (i, target = engine) => target.allocations.processStudent({ studentId: students[i]._id, roundId: round._id, actor, requestId: request('allocate') });
    const decide = (i, allocationId, action, target = engine) => target.allocations.decide({ allocationId, roundId: round._id, action, actor: studentActor(i), requestId: request(action) });
    const rejectCode = code => error => { assert.equal(error.code, code); return true; };
    let firstResult;
    let secondResult;

    await t.test('initialization is repeatable and database rejects invalid capacity', async () => {
      await initializeDatabase();
      await assert.rejects(models.SeatMatrix.collection.updateOne({ _id: poolA._id }, { $set: { availableSeats: -1 } }), error => error.code === 121);
      await assert.rejects(models.Student.create({ ...data.Student, _id: new Types.ObjectId(), applicationNumber: 'OTHER', email: 'other@example.test', rank: 1 }), error => error.code === 11000);
    });
    await t.test('administrative authorization and round sequence are enforced', async () => {
      await assert.rejects(engine.rounds.transition({ roundId: round._id, status: 'OPEN', actor: studentActor(0), requestId: 'bad' }), rejectCode('FORBIDDEN'));
      await assert.rejects(transition('PROCESSING'), rejectCode('INVALID_TRANSITION'));
      await transition('OPEN');
      await assert.rejects(insertStudents([{ ...data.Student }]), rejectCode('YEAR_FROZEN'));
      await assert.rejects(engine.catalogue.configurePool({ actor, requestId: 'frozen', data: { academicYear: 2026, college: college._id, branch: branchA._id, category: 'OPEN', totalSeats: 5 } }), rejectCode('YEAR_FROZEN'));
    });
    await t.test('preference ownership references versions duplicates and locks are enforced', async () => {
      await assert.rejects(save(0, [branchA], { actor: studentActor(1) }), rejectCode('FORBIDDEN'));
      await assert.rejects(save(0, [{ _id: new Types.ObjectId() }]), rejectCode('NOT_FOUND'));
      await assert.rejects(save(0, [branchA, branchA]), error => error.name === 'ValidationError');
      const preference = await save(0, [branchA]);
      await assert.rejects(save(0, [branchA]), rejectCode('VERSION_CONFLICT'));
      await save(0, [branchA], { expectedVersion: preference.__v });
      await lock(0);
      await lock(0);
      await assert.rejects(save(0, [branchB]), rejectCode('PREFERENCES_LOCKED'));
      await save(1, [branchA, branchB]);
      await lock(1);
      await save(2, [branchA]);
      await lock(2);
    });
    await t.test('deadline and rank checks precede allocation', async () => {
      await assert.rejects(transition('LOCKED'), rejectCode('ROUND_WINDOW_CLOSED'));
      now = new Date('2026-01-11');
      await transition('LOCKED');
      await transition('PROCESSING');
      await assert.rejects(process(2), rejectCode('RANK_ORDER_REQUIRED'));
      await assert.rejects(engine.allocations.processStudent({ studentId: students[0]._id, roundId: round._id, proposedSeatMatrixId: poolB._id, actor, requestId: 'stale' }), rejectCode('STALE_DECISION'));
      await assert.rejects(transition('COMPLETED'), rejectCode('ROUND_INCOMPLETE'));
      await assert.rejects(engine.reports.result({ studentId: students[0]._id, roundId: round._id, actor: studentActor(0) }), rejectCode('RESULT_UNPUBLISHED'));
    });
    await t.test('failures after each write stage roll back all related records', async () => {
      for (const stage of ['seat-updated', 'allocation-created', 'result-created']) {
        const failing = createDbmsEngine({ clock: () => now, checkpoint: async label => { if (label === stage) throw new Error('Injected failure'); } });
        await assert.rejects(process(0, failing), /Injected failure/);
        assert.equal((await models.SeatMatrix.findById(poolA._id)).availableSeats, 1);
        assert.equal(await models.Allocation.countDocuments(), 0);
        assert.equal(await models.SeatHolding.countDocuments(), 0);
        assert.equal(await models.RoundResult.countDocuments(), 0);
        assert.equal((await models.Student.findById(students[0]._id)).status, 'ELIGIBLE');
      }
    });
    await t.test('concurrent duplicate requests decrement exactly once and exhaust the last seat', async () => {
      const [one, duplicate] = await Promise.all([process(0), process(0)]);
      assert.equal(String(one._id), String(duplicate._id));
      firstResult = one;
      secondResult = await process(1);
      assert.equal((await process(2)).outcome, 'UNALLOCATED');
      assert.equal(await models.Allocation.countDocuments(), 2);
      assert.equal(await models.AuditEvent.countDocuments({ action: 'ALLOCATION_CREATED' }), 2);
      assert.equal((await engine.reports.reconcile({ academicYear: 2026, actor })).consistent, true);
      await transition('COMPLETED');
      await transition('PUBLISHED');
    });
    await t.test('acceptance release and upgrade request are replay-safe and owner-restricted', async () => {
      await assert.rejects(decide(1, firstResult.allocation, 'RELEASE'), rejectCode('FORBIDDEN'));
      await decide(0, firstResult.allocation, 'ACCEPT');
      await decide(0, firstResult.allocation, 'ACCEPT');
      const failing = createDbmsEngine({ clock: () => now, checkpoint: async label => { if (label === 'decision-saved') throw new Error('Injected decision failure'); } });
      await assert.rejects(decide(0, firstResult.allocation, 'RELEASE', failing), /Injected decision failure/);
      assert.equal((await models.SeatMatrix.findById(poolA._id)).availableSeats, 0);
      assert.equal((await models.Allocation.findById(firstResult.allocation)).status, 'ACCEPTED');
      await decide(0, firstResult.allocation, 'RELEASE');
      await decide(0, firstResult.allocation, 'RELEASE');
      assert.equal((await models.SeatMatrix.findById(poolA._id)).availableSeats, 1);
      await decide(1, secondResult.allocation, 'REQUEST_UPGRADE');
      const report = await engine.reports.result({ studentId: students[1]._id, roundId: round._id, actor: studentActor(1) });
      assert.equal(report.allocation.status, 'UPGRADE_REQUESTED');
      assert.equal(await models.AuditEvent.countDocuments({ action: 'SEAT_RELEASED' }), 1);
    });
    await t.test('next round retains held choice and checks the preceding decision window', async () => {
      round = await engine.catalogue.createRound({ actor, requestId: request('create'), data: {
        academicYear: 2026, roundNumber: 2, name: 'Round 2', ruleSet: rules._id,
        startDate: new Date('2026-01-11'), preferenceDeadline: new Date('2026-01-25'), endDate: new Date('2026-01-30'),
      } });
      await assert.rejects(transition('OPEN'), rejectCode('PREVIOUS_ROUND_OPEN'));
      now = new Date('2026-01-21');
      await transition('OPEN');
      await assert.rejects(save(1, [branchA]), rejectCode('CURRENT_SEAT_REQUIRED'));
      await save(1, [branchA, branchB]);
      await lock(1);
      await save(2, [branchB]);
      await lock(2);
      now = new Date('2026-01-26');
      await transition('LOCKED');
      await transition('PROCESSING');
      assert.equal((await process(0)).outcome, 'UNALLOCATED');
    });
    await t.test('failed upgrade retains old seat and successful upgrade returns its capacity', async () => {
      const failing = createDbmsEngine({ clock: () => now, checkpoint: async label => { if (label === 'allocation-created') throw new Error('Injected upgrade failure'); } });
      await assert.rejects(process(1, failing), /Injected upgrade failure/);
      assert.equal((await models.Allocation.findById(secondResult.allocation)).status, 'UPGRADE_REQUESTED');
      assert.equal((await models.SeatMatrix.findById(poolA._id)).availableSeats, 1);
      assert.equal((await models.SeatMatrix.findById(poolB._id)).availableSeats, 0);
      const upgraded = await process(1);
      assert.notEqual(String(upgraded.allocation), String(secondResult.allocation));
      assert.equal((await models.Allocation.findById(secondResult.allocation)).status, 'UPGRADED');
      assert.equal((await models.SeatMatrix.findById(poolB._id)).availableSeats, 1);
      secondResult = upgraded;
      const third = await process(2);
      assert.equal(third.outcome, 'ALLOTTED');
      await transition('COMPLETED');
      await transition('PUBLISHED');
      await decide(1, upgraded.allocation, 'ACCEPT');
      await decide(2, third.allocation, 'REQUEST_UPGRADE');
      assert.equal((await engine.reports.reconcile({ academicYear: 2026, actor })).consistent, true);
    });
    await t.test('third round preserves existing seats when no better eligible seat exists', async () => {
      round = await engine.catalogue.createRound({ actor, requestId: request('create'), data: {
        academicYear: 2026, roundNumber: 3, name: 'Round 3', ruleSet: rules._id, allowUpgrade: false,
        startDate: new Date('2026-02-01'), preferenceDeadline: new Date('2026-02-05'), endDate: new Date('2026-02-10'),
      } });
      now = new Date('2026-02-02');
      await transition('OPEN');
      await save(2, [branchA, branchB]);
      await lock(2);
      now = new Date('2026-02-06');
      await transition('LOCKED');
      await transition('PROCESSING');
      await process(0);
      assert.equal(String((await process(1)).allocation), String(secondResult.allocation));
      const retained = await process(2);
      assert.equal(retained.reason, 'Previous seat retained');
      await transition('COMPLETED');
      await transition('PUBLISHED');
      await decide(2, retained.allocation, 'ACCEPT');
      await assert.rejects(decide(2, retained.allocation, 'REQUEST_UPGRADE'), rejectCode('ACTION_DISABLED'));
      assert.equal(await models.SeatHolding.countDocuments(), 2);
      assert.equal((await engine.reports.reconcile({ academicYear: 2026, actor })).consistent, true);
      assert.equal((await engine.reports.history({ studentId: students[1]._id, actor: studentActor(1) })).length, 2);
      assert.equal(await models.RoundResult.countDocuments(), 9);
    });
  } finally {
    if (connection && connection.name === dbName && /^counseldesk_test_[a-f0-9]{16}$/.test(dbName)) await connection.db.dropDatabase();
    await disconnectDB();
  }
});
