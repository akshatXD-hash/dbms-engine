import { Schema } from 'mongoose';
import { RESULT_STATUSES } from '../constants/domain.js';
import { options, text, year, reference, state, compile } from './shared/schema.js';
const schema = new Schema({
  student: reference('Student'), round: reference('Round'), academicYear: year(),
  outcome: state(RESULT_STATUSES), allocation: reference('Allocation', false),
  reason: text(500), processedAt: { type: Date, required: true, default: Date.now },
}, options);
schema.pre('validate', function () {
  if ((this.outcome === 'ALLOTTED') !== Boolean(this.allocation)) {
    this.invalidate('allocation', 'Only ALLOTTED results must reference an allocation');
  }
});
schema.index({ student: 1, round: 1 }, { unique: true });
schema.index({ round: 1, outcome: 1 });
export default compile('RoundResult', schema, 'round_results');
