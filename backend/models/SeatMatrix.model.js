import { Schema } from 'mongoose';
import { options, code, integer, year, reference, compile } from './shared/schema.js';
const schema = new Schema({
  academicYear: year(), college: reference('College'), branch: reference('Branch'),
  category: code(), totalSeats: integer(), availableSeats: integer(),
}, options);
schema.pre('validate', function () {
  if (this.availableSeats > this.totalSeats) {
    this.invalidate('availableSeats', 'Available seats cannot exceed total seats');
  }
});
// Capacity is shared across rounds of one year, not duplicated each round.
schema.index({ academicYear: 1, branch: 1, category: 1 }, { unique: true });
schema.index({ academicYear: 1, college: 1, category: 1 });
export default compile('SeatMatrix', schema, 'seat_matrices');
