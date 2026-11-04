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

test('generates a valid diverse batch of 250 uniquely identified students offline', async () => {
  const students = await generateStudents();
  assert.equal(students.length, 250);
  for (const field of ['applicationNumber', 'email', 'rank', 'name', 'passwordHash']) {
    assert.equal(new Set(students.map(student => student[field])).size, 250, `Duplicate ${field}`);
  }
  assert.equal(students[0].applicationNumber, 'SYNTH2026-0001');
  assert.equal(students[249].applicationNumber, 'SYNTH2026-0250');
  assert.deepEqual([...new Set(students.map(student => student.category))], seedCategories);
  assert.deepEqual(Object.fromEntries(['VERIFIED', 'PENDING', 'REJECTED'].map(status => [
    status, students.filter(student => student.verificationStatus === status).length,
  ])), { VERIFIED: 200, PENDING: 25, REJECTED: 25 });
  for (const student of students) {
    assert.ok(student.email.endsWith('@counseldesk.example.test'));
    assert.ok(student.dateOfBirth < new Date());
    assert.equal(getRounds(student.passwordHash), 10);
    assert.equal(student.password, undefined);
    assert.equal(student.status, student.verificationStatus === 'VERIFIED' ? 'ELIGIBLE' : 'REGISTERED');
    await new Student(student).validate();
  }
  assert.equal(Student.db.readyState, 0);
});
