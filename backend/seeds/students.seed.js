import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import Student from '../models/Student.model.js';
import { Round, CounsellingCycle } from '../models/index.js';
import { createContext, requireCondition, requireUnopenedYear } from '../services/core.js';

const firstNames = [
  'Aarav', 'Aditi', 'Arjun', 'Ananya', 'Dev', 'Diya', 'Ishaan', 'Isha', 'Kabir', 'Kavya',
  'Krish', 'Meera', 'Neel', 'Nisha', 'Pranav', 'Priya', 'Rohan', 'Riya', 'Sahil', 'Sana',
  'Shaurya', 'Shreya', 'Tanay', 'Tara', 'Vihaan', 'Vidya', 'Yash', 'Zoya', 'Aditya', 'Avni',
];
const lastNames = ['Sharma', 'Patel', 'Rao', 'Naik', 'Iyer', 'Shah', 'Reddy', 'Joshi', 'Verma', 'Nair'];
export const seedCategories = ['OPEN', 'OBC', 'SC', 'ST', 'EWS'];

export function validateSeedOptions({ count = 250, academicYear = 2026 } = {}) {
  if (!Number.isInteger(count) || count < 200 || count > 300) {
    throw new RangeError('Student count must be an integer from 200 to 300');
  }
  if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2200) {
    throw new RangeError('Academic year must be an integer from 2000 to 2200');
  }
  if (academicYear - 18 >= new Date().getUTCFullYear()) {
    throw new RangeError('Academic year would generate future birth dates');
  }
  return { count, academicYear };
}

export async function generateStudents(options = {}) {
  const { count, academicYear } = validateSeedOptions(options);
  const students = [];
  for (let index = 0; index < count; index++) {
    const number = String(index + 1).padStart(4, '0');
    const verificationBucket = Math.floor(index / seedCategories.length) % 10;
    const verificationStatus = verificationBucket < 8 ? 'VERIFIED' : verificationBucket === 8 ? 'PENDING' : 'REJECTED';
    const student = {
      applicationNumber: `SYNTH${academicYear}-${number}`,
      academicYear,
      name: `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]}`,
      dateOfBirth: new Date(Date.UTC(academicYear - 18 - (index % 3), index % 12, (index % 28) + 1)),
      email: `student.${academicYear}.${number}@counseldesk.example.test`,
      passwordHash: await hash(randomBytes(24).toString('base64url'), 10),
      rank: index + 1,
      category: seedCategories[index % seedCategories.length],
      eligibilityGroups: verificationStatus === 'VERIFIED' ? ['DEMO_LOCAL'] : [],
      verificationStatus,
      status: verificationStatus === 'VERIFIED' ? 'ELIGIBLE' : 'REGISTERED',
    };
    await new Student(student).validate();
    students.push(student);
  }
  return students;
}

export async function insertStudents(students) {
  requireCondition(Array.isArray(students) && students.length > 0, 'INVALID_SEED', 'Provide a nonempty student dataset', 400);
  const academicYear = students[0].academicYear;
  requireCondition(students.every(student => student.academicYear === academicYear), 'INVALID_SEED', 'Seed one academic year at a time', 400);
  for (const student of students) await new Student(student).validate();
  await Student.createCollection();
  await Student.createIndexes();
  await Round.createCollection();
  await CounsellingCycle.createCollection();
  await CounsellingCycle.createIndexes();
  const now = new Date();
  return createContext().transaction(academicYear, async session => {
    await requireUnopenedYear(academicYear, session);
    const result = await Student.bulkWrite(students.map(student => ({
      updateOne: {
        filter: { academicYear: student.academicYear, applicationNumber: student.applicationNumber },
        update: { $setOnInsert: { ...student, createdAt: now, updatedAt: now } },
        upsert: true,
        timestamps: false,
      },
    })), { session, ordered: true });
    return { inserted: result.upsertedCount, existing: result.matchedCount };
  });
}
