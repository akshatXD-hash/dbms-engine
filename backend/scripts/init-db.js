import { connectDB, disconnectDB } from '../config/db.js';
import { initializeDatabase } from '../config/initialize-db.js';

try {
  await connectDB();
  await initializeDatabase();
  console.log('Schema initialized. No sample records were inserted.');
} catch {
  console.error('Schema initialization failed. Check environment, replica-set access, collection permissions and existing duplicate data.');
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
