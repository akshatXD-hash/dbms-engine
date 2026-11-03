import { Schema } from 'mongoose';
import { COLLEGE_TYPES } from '../constants/domain.js';
import { options, text, code, state, compile } from './shared/schema.js';
const schema = new Schema({
  collegeCode: code(), name: text(200), location: text(200), type: state(COLLEGE_TYPES),
  website: { type: String, trim: true, validate: { validator(value) {
    if (value == null) return true;
    try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
  }, message: 'Website must be an HTTP(S) URL' } },
  isActive: { type: Boolean, default: true, required: true },
}, options);
schema.index({ collegeCode: 1 }, { unique: true });
schema.index({ location: 1, type: 1 });
export default compile('College', schema, 'colleges');
