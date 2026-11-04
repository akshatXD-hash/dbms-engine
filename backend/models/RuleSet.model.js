import { Schema } from 'mongoose';
import { options, text, code, integer, year, reference, uniqueValues, compile } from './shared/schema.js';
const poolRule = new Schema({
  category: code(),
  allowedStudentCategories: { type: [code()], required: true, validate: {
    validator: values => values.length > 0 && uniqueValues(values),
    message: 'Provide distinct eligible student categories',
  } },
  requiredEligibilityGroups: { type: [code()], default: [], validate: uniqueValues },
  requiresVerification: { type: Boolean, required: true, default: true },
}, { _id: false, strict: 'throw' });
const schema = new Schema({
  academicYear: year(), version: integer(1), name: text(), createdBy: reference('Admin'),
  seatCategories: { type: [poolRule], required: true, validate: {
    validator: values => values.length > 0 && uniqueValues(values.map(v => v.category)),
    message: 'Seat categories must be nonempty and unique in precedence order',
  } },
}, options);
schema.index({ academicYear: 1, version: 1 }, { unique: true });
export default compile('RuleSet', schema, 'rule_sets');
