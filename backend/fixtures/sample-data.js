import { Types } from 'mongoose';

// Synthetic demonstration data only. This fixture never connects or inserts.
// Hash is a syntactically valid fixture placeholder, not a usable account password.
export const fixtureHash = '$2b$12$' + 'A'.repeat(53);
export function sampleData() {
  const id = () => new Types.ObjectId();
  const ids = Object.fromEntries(['admin', 'student', 'college', 'branch', 'ruleSet', 'round', 'seatMatrix', 'preference', 'allocation', 'roundResult', 'auditEvent'].map(key => [key, id()]));
  const academicYear = 2026;
  return {
    Admin: { _id: ids.admin, name: 'Demo Admin', email: 'admin@example.test', passwordHash: fixtureHash },
    Student: {
      _id: ids.student, applicationNumber: 'DEMO0001', academicYear,
      name: 'Demo Student', dateOfBirth: new Date('2008-01-01'), email: 'student@example.test',
      passwordHash: fixtureHash, rank: 540, category: 'OPEN',
      verificationStatus: 'VERIFIED', status: 'ALLOTTED',
    },
    College: { _id: ids.college, collegeCode: 'DEMO01', name: 'Demo Engineering College', location: 'Demo City', type: 'GOVERNMENT' },
    Branch: { _id: ids.branch, college: ids.college, name: 'Computer Science', programCode: 'CSE', programType: 'BE', department: 'Engineering', durationYears: 4 },
    RuleSet: { _id: ids.ruleSet, academicYear, version: 1, name: 'Demo rules', createdBy: ids.admin,
      seatCategories: [{ category: 'OPEN', allowedStudentCategories: ['OPEN'], requiresVerification: false }] },
    Round: { _id: ids.round, academicYear, roundNumber: 1, name: 'Round 1', managedBy: ids.admin, ruleSet: ids.ruleSet,
      startDate: new Date('2026-11-01T00:00:00Z'), preferenceDeadline: new Date('2026-11-10T00:00:00Z'), endDate: new Date('2026-11-20T00:00:00Z'), status: 'COMPLETED' },
    SeatMatrix: { _id: ids.seatMatrix, academicYear, college: ids.college, branch: ids.branch, category: 'OPEN', totalSeats: 10, availableSeats: 9 },
    Preference: { _id: ids.preference, academicYear, student: ids.student, round: ids.round,
      choices: [{ college: ids.college, branch: ids.branch, preferenceOrder: 1 }], locked: true,
      submittedAt: new Date('2026-11-02T00:00:00Z'), lockedAt: new Date('2026-11-02T00:00:00Z') },
    Allocation: { _id: ids.allocation, academicYear, student: ids.student, round: ids.round,
      seatMatrix: ids.seatMatrix, preference: ids.preference, preferenceOrder: 1, rankSnapshot: 540, allocatedAt: new Date('2026-11-11T00:00:00Z') },
    RoundResult: { _id: ids.roundResult, academicYear, student: ids.student, round: ids.round,
      outcome: 'ALLOTTED', allocation: ids.allocation, reason: 'Highest eligible available preference', processedAt: new Date('2026-11-11T00:00:00Z') },
    AuditEvent: { _id: ids.auditEvent, action: 'ALLOCATION_CREATED', actorType: 'SYSTEM', student: ids.student,
      round: ids.round, allocation: ids.allocation, requestId: 'demo-round1-student1', summary: 'Demo allocation recorded', occurredAt: new Date('2026-11-11T00:00:00Z') },
  };
}
