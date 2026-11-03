export function databaseConfig(env = process.env) {
  const uri = env.MONGODB_URI?.trim();
  const dbName = env.MONGODB_DB_NAME?.trim();
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error('Set MONGODB_URI to a MongoDB connection string in backend/.env');
  }
  if (!dbName || !/^[A-Za-z0-9_-]{1,63}$/.test(dbName)) {
    throw new Error('Set MONGODB_DB_NAME to an explicit database name (letters, digits, _ or -)');
  }
  return { uri, dbName };
}
