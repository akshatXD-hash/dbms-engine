import { Schema } from 'mongoose';
import { STUDENT_STATUSES, VERIFICATION_STATUSES } from '../constants/domain.js';
import { options, text, code, email, integer, year, state, passwordHash, uniqueValues, compile } from './shared/schema.js';

const schema = new Schema({
  applicationNumber: code(),
  academicYear: year(),
  name: text(),
  dateOfBirth: { type: Date, required: true, validate: value => value < new Date() },
  email: email(),
  passwordHash: passwordHash(),
  rank: integer(1),
  category: code(),
  eligibilityGroups: { type: [String], default: [], validate: [
    { validator: uniqueValues, message: 'Eligibility groups must be unique' },
    { validator: values => values.every(v => /^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(v)), message: 'Invalid eligibility group code' },
  ] },
  verificationStatus: state(VERIFICATION_STATUSES, 'PENDING'),
  status: state(STUDENT_STATUSES, 'REGISTERED'),
}, options);
schema.index({ academicYear: 1, applicationNumber: 1 }, { unique: true });
schema.index({ academicYear: 1, email: 1 }, { unique: true });
// The supplied engine sheet rejects duplicate ranks. Tied ranks require an explicit future policy.
schema.index({ academicYear: 1, rank: 1 }, { unique: true });
schema.index({ academicYear: 1, status: 1, rank: 1 });
export default compile('Student', schema, 'students');
