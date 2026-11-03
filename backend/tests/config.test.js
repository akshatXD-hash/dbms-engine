import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseConfig } from '../config/env.js';

test('requires an explicit URI and database', () => {
  assert.throws(() => databaseConfig({}), /MONGODB_URI/);
  assert.throws(() => databaseConfig({ MONGODB_URI: 'mongodb://localhost' }), /MONGODB_DB_NAME/);
});
test('accepts replica-set and Atlas URI prefixes without connecting', () => {
  for (const uri of ['mongodb://localhost:27017/?replicaSet=rs0', 'mongodb+srv://example.test/']) {
    assert.deepEqual(databaseConfig({ MONGODB_URI: uri, MONGODB_DB_NAME: 'counseldesk_dev' }), {
      uri, dbName: 'counseldesk_dev',
    });
  }
});
test('rejects invalid configuration without including the secret', () => {
  assert.throws(() => databaseConfig({ MONGODB_URI: 'https://user:SECRET@example.test' }), error => {
    assert.equal(error.message.includes('SECRET'), false);
    return true;
  });
  assert.throws(() => databaseConfig({ MONGODB_URI: 'mongodb://localhost', MONGODB_DB_NAME: 'bad.name' }), /MONGODB_DB_NAME/);
});
