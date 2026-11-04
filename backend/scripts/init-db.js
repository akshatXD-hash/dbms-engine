import * as models from '../models/index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { seatMatrixValidator } from '../config/collection-validators.js';

try {
  const connection = await connectDB();
  for (const Model of Object.values(models)) {
    const name = Model.collection.collectionName;
    const exists = await connection.db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) {
      await connection.db.createCollection(name, name === 'seat_matrices'
        ? { validator: seatMatrixValidator, validationLevel: 'strict', validationAction: 'error' }
        : {});
    } else if (name === 'seat_matrices') {
      await connection.db.command({
        collMod: name, validator: seatMatrixValidator,
        validationLevel: 'strict', validationAction: 'error',
      });
    }
    await Model.createIndexes();
    console.log(`Initialized ${name}`);
  }
  console.log('Schema initialized. No sample records were inserted.');
} catch {
  console.error('Schema initialization failed. Check environment, replica-set access, collection permissions and existing duplicate data.');
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
