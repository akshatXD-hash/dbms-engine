import mongoose from 'mongoose';
import { databaseConfig } from './env.js';

export async function connectDB(env = process.env) {
  const { uri, dbName } = databaseConfig(env);
  try {
    await mongoose.connect(uri, {
      dbName, autoIndex: false, autoCreate: false,
      serverSelectionTimeoutMS: 10000,
    });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      throw new Error('Replica set or sharded cluster required');
    }
    return mongoose.connection;
  } catch {
    await mongoose.disconnect();
    // Driver errors can contain the URI/credentials. Never echo them to the CLI.
    throw new Error('MongoDB connection failed. Check credentials, access, and replica-set/Atlas configuration.');
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
