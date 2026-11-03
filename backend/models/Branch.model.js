import { Schema } from 'mongoose';
import { options, text, code, integer, reference, compile } from './shared/schema.js';
// Branch is an offering at one college, matching the ER diagram's N:1 relation.
const schema = new Schema({
  college: reference('College'), name: text(), programCode: code(),
  programType: text(40), department: text(), durationYears: integer(1, 8),
  isActive: { type: Boolean, default: true, required: true },
}, options);
schema.index({ college: 1, programCode: 1 }, { unique: true });
export default compile('Branch', schema, 'branches');
