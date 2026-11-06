import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleCategories } from '../services/allocation.service.js';
import { id, ServiceError } from '../services/core.js';
import { createDbmsEngine } from '../services/index.js';

test('eligibility follows configured precedence, verification and group requirements', () => {
  const rules = { seatCategories: [
    { category: 'OPEN', allowedStudentCategories: ['SC', 'OPEN'], requiresVerification: false, requiredEligibilityGroups: [] },
    { category: 'SC', allowedStudentCategories: ['SC'], requiresVerification: true, requiredEligibilityGroups: ['LOCAL'] },
  ] };
  const student = { category: 'SC', verificationStatus: 'PENDING', eligibilityGroups: ['LOCAL'] };
  assert.deepEqual(eligibleCategories(student, rules), ['OPEN']);
  student.verificationStatus = 'VERIFIED';
  assert.deepEqual(eligibleCategories(student, rules), ['OPEN', 'SC']);
  student.eligibilityGroups = [];
  assert.deepEqual(eligibleCategories(student, rules), ['OPEN']);
});

test('service identifiers reject objects and malformed strings', () => {
  for (const value of [undefined, '', 'bad', { $ne: null }]) assert.throws(() => id(value), ServiceError);
});

test('DBMS interface can be created without a database connection', () => {
  assert.deepEqual(Object.keys(createDbmsEngine()), ['catalogue', 'preferences', 'allocations', 'rounds', 'reports']);
});
