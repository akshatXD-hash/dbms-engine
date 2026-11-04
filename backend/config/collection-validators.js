export const seatMatrixValidator = {
  $and: [
    { $jsonSchema: {
      bsonType: 'object',
      required: ['academicYear', 'college', 'branch', 'category', 'totalSeats', 'availableSeats'],
      properties: {
        academicYear: { bsonType: ['int', 'long', 'double'], minimum: 2000, maximum: 2200, multipleOf: 1 },
        college: { bsonType: 'objectId' }, branch: { bsonType: 'objectId' },
        category: { bsonType: 'string', pattern: '^[A-Z0-9][A-Z0-9_-]{0,39}$' },
        totalSeats: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
        availableSeats: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
      },
    } },
    { $expr: { $lte: ['$availableSeats', '$totalSeats'] } },
  ],
};
