import { Schema } from 'mongoose';
import { options, integer, year, reference, uniqueValues, compile } from './shared/schema.js';
const choice = new Schema({
  college: reference('College'), branch: reference('Branch'), preferenceOrder: integer(1),
}, { strict: 'throw' });
const schema = new Schema({
  student: reference('Student'), round: reference('Round'), academicYear: year(),
  choices: { type: [choice], required: true, default: [] },
  locked: { type: Boolean, required: true, default: false },
  submittedAt: { type: Date }, lockedAt: { type: Date },
}, options);
schema.pre('validate', function () {
  if (!Array.isArray(this.choices)) {
    this.invalidate('choices', 'Choices must be an array');
    return;
  }
  if (!uniqueValues(this.choices.map(v => v.branch))) {
    this.invalidate('choices', 'A branch offering cannot appear twice');
  }
  if (!this.choices.every((v, i) => v.preferenceOrder === i + 1)) {
    this.invalidate('choices', 'Preference order must be contiguous and match array order, starting at 1');
  }
  if (this.locked && (!this.choices.length || !this.submittedAt || !this.lockedAt)) {
    this.invalidate('locked', 'A locked list requires choices, submittedAt and lockedAt');
  }
  if (!this.locked && this.lockedAt) this.invalidate('lockedAt', 'Draft lists cannot have lockedAt');
  if (this.lockedAt && this.submittedAt && this.lockedAt < this.submittedAt) {
    this.invalidate('lockedAt', 'Lock cannot precede submission');
  }
});
schema.index({ student: 1, round: 1 }, { unique: true });
schema.index({ round: 1, locked: 1, student: 1 });
export default compile('Preference', schema, 'preferences');
