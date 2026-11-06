import mongoose from 'mongoose';
import * as models from '../models/index.js';
import { HOLDING_STATUSES } from '../constants/domain.js';
import { seatMatrixValidator } from './collection-validators.js';

export async function initializeDatabase() {
  const db = mongoose.connection.db;
  for (const Model of Object.values(models)) {
    const name = Model.collection.collectionName;
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) {
      await db.createCollection(name, name === 'seat_matrices'
        ? { validator: seatMatrixValidator, validationLevel: 'strict', validationAction: 'error' }
        : {});
    } else if (name === 'seat_matrices') {
      await db.command({ collMod: name, validator: seatMatrixValidator, validationLevel: 'strict', validationAction: 'error' });
    }
    await Model.createIndexes();
  }
  const duplicates = await models.Allocation.aggregate([
    { $match: { status: { $in: HOLDING_STATUSES } } },
    { $group: { _id: { student: '$student', academicYear: '$academicYear' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }, { $limit: 1 },
  ]);
  if (duplicates.length) throw new Error('Resolve multiple held allocations before migration');
  for await (const allocation of models.Allocation.find({ status: { $in: HOLDING_STATUSES } }).cursor()) {
    const key = { student: allocation.student, academicYear: allocation.academicYear };
    const holding = await models.SeatHolding.findOne(key);
    if (holding && !holding.allocation.equals(allocation._id)) throw new Error('Existing holding conflicts with allocation history');
    await models.SeatHolding.updateOne(key, { $setOnInsert: { ...key, allocation: allocation._id } }, { upsert: true });
  }
  const indexes = await models.Allocation.collection.indexes();
  if (indexes.some(index => index.name === 'one_held_seat_per_student_year')) {
    await models.Allocation.collection.dropIndex('one_held_seat_per_student_year');
  }
}
