import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import * as models from '../models/index.js';
import { sampleData } from '../fixtures/sample-data.js';

const make = (name, changes = {}) => new models[name]({ ...sampleData()[name], ...changes });
async function rejects(name, changes, field) {
  await assert.rejects(make(name, changes).validate(), error => {
    assert.equal(error.name, 'ValidationError');
    if (field) assert.ok(error.errors[field], `Expected error on ${field}: ${error.message}`);
    return true;
  });
}

for (const name of Object.keys(models)) {
  test(`${name} accepts its complete sample`, async () => { await make(name).validate(); });
}

test('normalizes identity email and application code', () => {
  const student = make('Student', { email: '  DEMO@Example.Test ', applicationNumber: ' demo01 ' });
  assert.equal(student.email, 'demo@example.test');
  assert.equal(student.applicationNumber, 'DEMO01');
});

for (const rank of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`rejects invalid rank ${rank}`, () => rejects('Student', { rank }, 'rank'));
}
test('rejects missing application identity', () => rejects('Student', { applicationNumber: undefined }, 'applicationNumber'));
test('rejects malformed email', () => rejects('Student', { email: 'student@' }, 'email'));
test('rejects future birth date', () => rejects('Student', { dateOfBirth: '2999-01-01' }, 'dateOfBirth'));
test('rejects duplicate eligibility groups', () => rejects('Student', { eligibilityGroups: ['LOCAL', 'LOCAL'] }, 'eligibilityGroups'));
test('rejects unknown verification state', () => rejects('Student', { verificationStatus: 'OK' }, 'verificationStatus'));

for (const name of ['Student', 'Admin']) {
  test(`${name} rejects plaintext stored as a hash`, () => rejects(name, { passwordHash: 'password123' }, 'passwordHash'));
  test(`${name} excludes hash from serialized values and default selection`, () => {
    const doc = make(name);
    assert.equal(doc.toJSON().passwordHash, undefined);
    assert.equal(doc.toObject().passwordHash, undefined);
    assert.equal(models[name].schema.path('passwordHash').options.select, false);
  });
  test(`${name} rejects a plaintext password field`, () => {
    assert.throws(() => make(name, { password: 'never-store-this' }), { name: 'StrictModeError' });
  });
}

test('rejects unknown admin role', () => rejects('Admin', { role: 'ROOT' }, 'role'));
test('rejects unsafe website scheme', () => rejects('College', { website: 'javascript:alert(1)' }, 'website'));
test('rejects branch without college', () => rejects('Branch', { college: undefined }, 'college'));
test('rejects malformed reference', () => rejects('Branch', { college: 'not-an-object-id' }, 'college'));
test('rejects fractional course duration', () => rejects('Branch', { durationYears: 3.5 }, 'durationYears'));

for (const seats of [-1, 1.5, Infinity]) {
  test(`rejects invalid seat count ${seats}`, () => rejects('SeatMatrix', { availableSeats: seats }, 'availableSeats'));
}
test('rejects vacancy greater than capacity', () => rejects('SeatMatrix', { totalSeats: 2, availableSeats: 3 }, 'availableSeats'));
test('accepts an empty seat pool', async () => { await make('SeatMatrix', { totalSeats: 0, availableSeats: 0 }).validate(); });
test('rejects missing capacity', () => rejects('SeatMatrix', { totalSeats: undefined }, 'totalSeats'));

test('rejects duplicate preference offering', async () => {
  const { choices } = sampleData().Preference;
  await rejects('Preference', { choices: [choices[0], { ...choices[0], preferenceOrder: 2 }] }, 'choices');
});
test('rejects gaps in preference order', async () => {
  const { choices } = sampleData().Preference;
  await rejects('Preference', { choices: [{ ...choices[0], preferenceOrder: 2 }] }, 'choices');
});
test('rejects empty locked list', () => rejects('Preference', { choices: [] }, 'locked'));
test('rejects null choices with a validation error', () => rejects('Preference', { choices: null }, 'choices'));
test('allows an empty draft', async () => {
  await make('Preference', { choices: [], locked: false, submittedAt: undefined, lockedAt: undefined }).validate();
});
test('rejects a locked list without a timestamp', () => rejects('Preference', { lockedAt: undefined }, 'locked'));
test('rejects lock before submission', () => rejects('Preference', { lockedAt: '2026-11-01' }, 'lockedAt'));
test('rejects draft with lock timestamp', () => rejects('Preference', { locked: false }, 'lockedAt'));

test('rejects reversed round window', () => rejects('Round', { endDate: '2026-10-01' }, 'preferenceDeadline'));
test('rejects deadline at round opening', () => rejects('Round', { preferenceDeadline: '2026-11-01T00:00:00Z' }, 'preferenceDeadline'));
test('rejects publication without date', () => rejects('Round', { status: 'PUBLISHED' }, 'publishedAt'));
test('accepts configurable later rounds', async () => { await make('Round', { roundNumber: 4 }).validate(); });
test('accepts published round with timestamp', async () => {
  await make('Round', { status: 'PUBLISHED', publishedAt: '2026-11-12' }).validate();
});

test('rejects empty rules', () => rejects('RuleSet', { seatCategories: [] }, 'seatCategories'));
test('rejects duplicate category rules', async () => {
  const { seatCategories } = sampleData().RuleSet;
  await rejects('RuleSet', { seatCategories: [seatCategories[0], seatCategories[0]] }, 'seatCategories');
});
test('rejects empty eligible-category list', () => rejects('RuleSet', {
  seatCategories: [{ category: 'OPEN', allowedStudentCategories: [] }],
}, 'seatCategories.0.allowedStudentCategories'));
test('keeps reservation precedence as configured', async () => {
  const doc = make('RuleSet', { seatCategories: [
    { category: 'Z_POOL', allowedStudentCategories: ['DEMO'] },
    { category: 'A_POOL', allowedStudentCategories: ['DEMO'] },
  ] });
  await doc.validate();
  assert.deepEqual(doc.seatCategories.map(v => v.category), ['Z_POOL', 'A_POOL']);
});

test('rejects self-replacing allocation', async () => {
  const _id = new Types.ObjectId();
  await rejects('Allocation', { _id, previousAllocation: _id }, 'previousAllocation');
});
test('requires the concrete seat pool', () => rejects('Allocation', { seatMatrix: undefined }, 'seatMatrix'));
test('requires allocation for an allotted result', () => rejects('RoundResult', { allocation: undefined }, 'allocation'));
test('rejects a phantom seat on UNALLOCATED result', () => rejects('RoundResult', { outcome: 'UNALLOCATED' }, 'allocation'));
test('stores unallocated and failed outcomes without fake allocation records', async () => {
  for (const outcome of ['UNALLOCATED', 'FAILED']) {
    await make('RoundResult', { outcome, allocation: undefined }).validate();
  }
});
test('requires a human audit actor id', () => rejects('AuditEvent', { actorType: 'Admin' }, 'actor'));
test('rejects a misleading SYSTEM actor id', () => rejects('AuditEvent', { actor: new Types.ObjectId() }, 'actor'));
test('does not open a connection on model import', () => {
  assert.equal(models.Student.db.readyState, 0);
});
