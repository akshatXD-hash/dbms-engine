import { Schema } from 'mongoose';
import { ROUND_STATUSES } from '../constants/domain.js';
import { options, text, integer, year, reference, state, compile } from './shared/schema.js';
const schema = new Schema({
  academicYear: year(), roundNumber: integer(1), name: text(),
  managedBy: reference('Admin'), ruleSet: reference('RuleSet'),
  startDate: { type: Date, required: true },
  preferenceDeadline: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: state(ROUND_STATUSES, 'DRAFT'),
  allowUpgrade: { type: Boolean, required: true, default: true },
  allowRelease: { type: Boolean, required: true, default: true },
  publishedAt: { type: Date },
}, options);
schema.pre('validate', function () {
  if (!(this.startDate < this.preferenceDeadline && this.preferenceDeadline < this.endDate)) {
    this.invalidate('preferenceDeadline', 'Require startDate < preferenceDeadline < endDate');
  }
  if ((this.status === 'PUBLISHED') !== Boolean(this.publishedAt)) {
    this.invalidate('publishedAt', 'Publication timestamp must match PUBLISHED status');
  }
});
schema.index({ academicYear: 1, roundNumber: 1 }, { unique: true });
schema.index({ academicYear: 1, status: 1 });
export default compile('Round', schema, 'rounds');
