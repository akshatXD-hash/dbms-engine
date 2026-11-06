import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { initializeDatabase } from '../config/initialize-db.js';
import { Admin, College, Branch, RuleSet, Round, SeatMatrix } from '../models/index.js';
import { generateStudents, insertStudents, seedCategories } from '../seeds/students.seed.js';

async function existingOrCreate(Model, filter, values) {
  const existing = await Model.findOne(filter);
  return existing ?? Model.create({ ...filter, ...values });
}

try {
  await connectDB();
  await initializeDatabase();
  const academicYear = 2026;
  if (await Round.exists({ academicYear, status: { $ne: 'DRAFT' } })) throw new Error('Counselling already started');
  const existingRules = await RuleSet.findOne({ academicYear, version: 1 });
  if (existingRules && existingRules.name !== 'Synthetic counselling rules') throw new Error('Existing rules conflict with demo configuration');
  let students;
  try {
    students = JSON.parse(await readFile(new URL('../seeds/generated/students.json', import.meta.url), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    students = await generateStudents({ academicYear });
  }
  if (students.length < 200 || students.length > 300 || students.some(student => student.academicYear !== academicYear || !student.applicationNumber.startsWith(`SYNTH${academicYear}-`))) throw new Error('Unexpected synthetic dataset');
  const inserted = await insertStudents(students);
  const admin = await existingOrCreate(Admin, { email: 'demo.admin@counseldesk.example.test' }, {
    name: 'Synthetic Counselling Administrator', role: 'COUNSELLING_ADMIN', passwordHash: await hash(randomBytes(24).toString('base64url'), 10),
  });
  let poolCount = 0;
  for (let number = 1; number <= 2; number++) {
    const college = await existingOrCreate(College, { collegeCode: `SYNTH_COLLEGE_${number}` }, {
      name: `Synthetic Engineering College ${number}`, location: `Demo City ${number}`, type: number === 1 ? 'GOVERNMENT' : 'PRIVATE',
    });
    for (const [programCode, name] of [['CSE', 'Computer Science'], ['ECE', 'Electronics'], ['ME', 'Mechanical Engineering']]) {
      const branch = await existingOrCreate(Branch, { college: college._id, programCode }, { name, programType: 'BE', department: name, durationYears: 4 });
      for (const category of seedCategories) {
        await existingOrCreate(SeatMatrix, { academicYear, branch: branch._id, category }, { college: college._id, totalSeats: 5, availableSeats: 5 });
        poolCount++;
      }
    }
  }
  const rules = await existingOrCreate(RuleSet, { academicYear, version: 1 }, {
    name: 'Synthetic counselling rules', createdBy: admin._id,
    seatCategories: seedCategories.map(category => ({
      category, allowedStudentCategories: category === 'OPEN' ? seedCategories : [category],
      requiredEligibilityGroups: category === 'OPEN' ? [] : ['DEMO_LOCAL'], requiresVerification: category !== 'OPEN',
    })),
  });
  const start = Date.now();
  const day = 24 * 60 * 60 * 1000;
  for (let roundNumber = 1; roundNumber <= 3; roundNumber++) {
    const offset = (roundNumber - 1) * 4 * day;
    await existingOrCreate(Round, { academicYear, roundNumber }, {
      name: `Round ${roundNumber}`, managedBy: admin._id, ruleSet: rules._id,
      startDate: new Date(start + offset), preferenceDeadline: new Date(start + offset + day),
      endDate: new Date(start + offset + 3 * day), allowUpgrade: roundNumber < 3,
    });
  }
  console.log(JSON.stringify({ students: inserted, colleges: 2, branches: 6, seatPools: poolCount, totalDemoSeats: 150, draftRounds: 3 }));
} catch {
  console.error('Demo setup failed. Check the connection, synthetic dataset and existing records. Started rounds or conflicting rules cannot be overwritten.');
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
