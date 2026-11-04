import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import Student from '../models/Student.model.js';

const firstNames = [
  'Aarav', 'Aditi', 'Arjun', 'Ananya', 'Dev', 'Diya', 'Ishaan', 'Isha', 'Kabir', 'Kavya',
  'Krish', 'Meera', 'Neel', 'Nisha', 'Pranav', 'Priya', 'Rohan', 'Riya', 'Sahil', 'Sana',
  'Shaurya', 'Shreya', 'Tanay', 'Tara', 'Vihaan', 'Vidya', 'Yash', 'Zoya', 'Aditya', 'Avni',
];
const lastNames = ['Sharma', 'Patel', 'Rao', 'Naik', 'Iyer', 'Shah', 'Reddy', 'Joshi', 'Verma', 'Nair'];
// Illustrative categories only; configure matching RuleSets before allocation.
export const seedCategories = ['OPEN', 'OBC', 'SC', 'ST', 'EWS'];

export function validateSeedOptions({ count = 250, academicYear = 2026 } = {}) {
  if (!Number.isInteger(count) || count < 200 || count > 300) {
    throw new RangeError('Student count must be an integer from 200 to 300');
  }
  if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2200) {
    throw new RangeError('Academic year must be an integer from 2000 to 2200');
  }
  // A seed birth date must also satisfy the model's past-date requirement.
  if (academicYear - 18 >= new Date().getUTCFullYear()) {
    throw new RangeError('Academic year would generate future birth dates');
  }
  return { count, academicYear };
}
