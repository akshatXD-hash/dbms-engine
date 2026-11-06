import * as models from '../models/index.js';
import { sampleData } from '../fixtures/sample-data.js';

const samples = sampleData();
for (const [name, Model] of Object.entries(models)) {
  await new Model(samples[name]).validate();
  console.log(`${name}: valid fixture, ${Model.schema.indexes().length} declared indexes`);
}
console.log(`All ${Object.keys(models).length} models validated offline. No MongoDB connection was opened.`);
