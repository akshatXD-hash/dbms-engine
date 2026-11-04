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
