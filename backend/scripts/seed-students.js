import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { parseArgs } from 'node:util';
import { connectDB, disconnectDB } from '../config/db.js';
import { generateStudents, insertStudents } from '../seeds/students.seed.js';

try {
  const { values } = parseArgs({ options: {
    count: { type: 'string', default: '250' },
    year: { type: 'string', default: '2026' },
    write: { type: 'boolean', default: false },
  } });
  const students = await generateStudents({ count: Number(values.count), academicYear: Number(values.year) });
  const outputDirectory = new URL('../seeds/generated/', import.meta.url);
  const outputFile = new URL('students.json', outputDirectory);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, JSON.stringify(students, null, 2) + '\n', 'utf8');
  console.log(`Generated and validated ${students.length} synthetic students in backend/seeds/generated/students.json`);
  if (values.write) {
    const envFile = new URL('../.env', import.meta.url);
    if (existsSync(envFile)) loadEnvFile(envFile);
    await connectDB();
    const result = await insertStudents(students);
    console.log(`Database seed complete: ${result.inserted} inserted; ${result.existing} already present.`);
  } else {
    console.log('File-only run. Use --write to insert these students into the configured database.');
  }
} catch {
  console.error('Student seed failed.');
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
