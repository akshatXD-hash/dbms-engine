import test from 'node:test';
import assert from 'node:assert/strict';
import * as models from '../models/index.js';

function uniqueIndex(model, keys) {
  return model.schema.indexes().find(([fields, options]) =>
    JSON.stringify(fields) === JSON.stringify(keys) && options.unique);
}

test('declares year-scoped student identities and rank uniqueness', () => {
  for (const key of ['applicationNumber', 'email', 'rank']) {
    assert.ok(uniqueIndex(models.Student, { academicYear: 1, [key]: 1 }));
  }
});
test('declares per-round preference, allocation and result idempotency boundaries', () => {
  for (const name of ['Preference', 'Allocation', 'RoundResult']) {
    assert.ok(uniqueIndex(models[name], { student: 1, round: 1 }));
  }
});
test('declares only one held seat across rounds but permits released history', () => {
  const [, settings] = uniqueIndex(models.Allocation, { student: 1, academicYear: 1 });
  assert.deepEqual(settings.partialFilterExpression, {
    status: { $in: ['ALLOTTED', 'ACCEPTED', 'UPGRADE_REQUESTED'] },
  });
});
test('does not create a separate capacity pool for each round', () => {
  assert.ok(uniqueIndex(models.SeatMatrix, { academicYear: 1, branch: 1, category: 1 }));
  assert.equal(models.SeatMatrix.schema.path('round'), undefined);
});
test('scopes programme codes to colleges and rule versions to years', () => {
  assert.ok(uniqueIndex(models.Branch, { college: 1, programCode: 1 }));
  assert.ok(uniqueIndex(models.RuleSet, { academicYear: 1, version: 1 }));
  assert.ok(uniqueIndex(models.Round, { academicYear: 1, roundNumber: 1 }));
});
// These verify index declarations only. Actual E11000/concurrency behaviour must
// be exercised against a replica set in phase 2, after db:init creates indexes.
