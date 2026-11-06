import { Schema } from 'mongoose';
import { options, year, integer, compile } from './shared/schema.js';
const schema = new Schema({
  academicYear: year(),
  revision: { ...integer(), default: 0 },
}, options);
schema.index({ academicYear: 1 }, { unique: true });
export default compile('CounsellingCycle', schema, 'counselling_cycles');
