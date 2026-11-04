import { Schema } from 'mongoose';
import { ALLOCATION_STATUSES, HOLDING_STATUSES } from '../constants/domain.js';
import { options, integer, year, reference, state, compile } from './shared/schema.js';
const schema = new Schema({
  student: reference('Student'), round: reference('Round'), academicYear: year(),
  seatMatrix: reference('SeatMatrix'), preference: reference('Preference'),
  preferenceOrder: integer(1), rankSnapshot: integer(1),
  status: state(ALLOCATION_STATUSES, 'ALLOTTED'),
  previousAllocation: reference('Allocation', false),
  allocatedAt: { type: Date, required: true, default: Date.now },
}, options);
schema.pre('validate', function () {
  if (this.previousAllocation?.equals(this._id)) {
    this.invalidate('previousAllocation', 'An allocation cannot replace itself');
  }
});
schema.index({ student: 1, round: 1 }, { unique: true });
schema.index({ student: 1, academicYear: 1 }, {
  unique: true, name: 'one_held_seat_per_student_year',
  partialFilterExpression: { status: { $in: HOLDING_STATUSES } },
});
schema.index({ seatMatrix: 1, status: 1 });
schema.index({ round: 1, status: 1 });
export default compile('Allocation', schema, 'allocations');
