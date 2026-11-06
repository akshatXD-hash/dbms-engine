import { Schema } from 'mongoose';
import { options, year, reference, compile } from './shared/schema.js';
const schema = new Schema({
  student: reference('Student'), academicYear: year(), allocation: reference('Allocation'),
}, options);
schema.index({ student: 1, academicYear: 1 }, { unique: true });
schema.index({ allocation: 1 }, { unique: true });
export default compile('SeatHolding', schema, 'seat_holdings');
