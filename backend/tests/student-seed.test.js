import test from 'node:test';
import assert from 'node:assert/strict';
import { getRounds } from 'bcryptjs';
import Student from '../models/Student.model.js';
import { generateStudents, seedCategories, validateSeedOptions } from '../seeds/students.seed.js';

test('seed supports 200–300 students and defaults to 250', () => {
  assert.deepEqual(validateSeedOptions(), { count: 250, academicYear: 2026 });
  for (const count of [200, 250, 300]) assert.equal(validateSeedOptions({ count }).count, count);
  for (const count of [0, 199, 301, 250.5, NaN, '250']) {
    assert.throws(() => validateSeedOptions({ count }), RangeError);
  }
});

test('rejects years outside the schema or producing future birth dates', () => {
  for (const academicYear of [1999, 2201, 2026.5, NaN, 2200]) {
    assert.throws(() => validateSeedOptions({ academicYear }), RangeError);
  }
});
