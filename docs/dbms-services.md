# Connecting the engines

E1 owns database writes. E2 schedules jobs, E3 proposes choices and E4 authenticates
requests before calling the same JavaScript interface.

```js
import { connectDB, disconnectDB } from '../config/db.js';
import { dbms } from '../services/index.js';

await connectDB();
const result = await dbms.allocations.processStudent({
  studentId, roundId, actor: { type: 'SYSTEM' }, requestId: jobId,
});
await disconnectDB();
```

Servers connect once at startup and disconnect at shutdown. Initialize indexes
before starting workers.

## Actors and correlation

Actors are `{ type: 'Admin', id }`, `{ type: 'Student', id }`, or internal
`{ type: 'SYSTEM' }`. Ownership checks protect students. Administrator operations
require active SUPER_ADMIN or COUNSELLING_ADMIN records. SYSTEM is accepted only
for allocation processing. E4 must build actors from trusted sessions, never from
browser bodies. These services do not implement login or token verification.

Audited mutations require a nonempty requestId of at most 100 characters. It is an
audit correlation identifier, not a globally unique request receipt. Replay safety
comes from the student/round result and allocation state.

## Interface

| Method | Input | Result |
| --- | --- | --- |
| catalogue.createStudent | data, optional password, actor, requestId | Student without hash |
| catalogue.verifyStudent | studentId, verificationStatus, eligibilityGroups, actor, requestId | Updated student |
| catalogue.createCollege | data, actor | College |
| catalogue.createBranch | data, actor | Branch linked to active college |
| catalogue.createRules | data, actor, requestId | Immutable RuleSet version |
| catalogue.configurePool | data including totalSeats, actor, requestId | Initial seat pool |
| catalogue.createRound | data, actor, requestId | DRAFT round |
| preferences.save | studentId, roundId, choices, expectedVersion, actor, requestId | Preferences and __v |
| preferences.lock | studentId, roundId, actor, requestId | Locked preferences |
| rounds.transition | roundId, status, actor, requestId | Updated round |
| allocations.processStudent | studentId, roundId, optional proposedSeatMatrixId, actor, requestId | RoundResult |
| allocations.decide | allocationId, roundId, action, actor, requestId | Updated allocation |
| reports.catalogue | academicYear | Active catalogue and pools |
| reports.result | studentId, roundId, actor | Published result or admin preview |
| reports.history | studentId, actor | Allocation history |
| reports.auditHistory | academicYear, actor | Year's audit records |
| reports.reconcile | academicYear, actor | consistent, capacities, issues |

Data objects use schema field names. Services set the admin identity and initial
round status. configurePool accepts totalSeats, never availableSeats. createStudent
hashes its separate password argument; data cannot contain passwordHash.

## Preferences

Choices are `{ college, branch }`; array order determines preferenceOrder. Omit
expectedVersion on creation, and send the current __v on edits. Conflicting edits
get VERSION_CONFLICT. Empty drafts are allowed; empty locked lists are rejected.
Saving and locking require `[startDate, preferenceDeadline)`. Locked lists never
change. A new round uses a new list. A student holding a seat must include that
branch so new preferences can be compared with the current seat.

## E2 and E3 contracts

Transitions are DRAFT → OPEN → LOCKED → PROCESSING → COMPLETED → PUBLISHED.
A later round opens only after the preceding round is published and its decision
window closes. Processing starts after the preference deadline and before round
end. Publication requires a successful result for every non-withdrawn student.
UNALLOCATED is successful; FAILED blocks publication.

E2 must submit participating students in ascending rank order. Premature jobs get
RANK_ORDER_REQUIRED and must be rescheduled. Do not skip unverified students: rules
may permit them to compete for open seats. Students without locked choices get
UNALLOCATED unless retaining a held seat. Replayed jobs return the existing result,
including after publication. Failed transactions leave no partial result. E2 must
provide its own bounded job retries, backoff, cancellation and monitoring.

E3 may send proposedSeatMatrixId. E1 checks current vacancies, eligibility and
preference/category order. A stale or inferior proposal gets STALE_DECISION without
consuming a seat. Without a proposal, E1 runs a reference selector. Optimizations
cannot override database checks.

## Transactions and decisions

Allocation atomically changes capacity, allocation history, SeatHolding, student
state, result and audit history. Operations within a transaction are sequential;
[Mongoose does not support parallel operations inside transactions](https://mongoosejs.com/docs/transactions.html).

Actions are ACCEPT, RELEASE and REQUEST_UPGRADE. They require a matching published
result, an open decision window and no later opened round. Replays of a completed
state do not consume or release another seat. RELEASE enables later-round
participation; it is not permanent withdrawal.

REQUEST_UPGRADE keeps the old seat until a later round finds a choice above that
branch in the new list. Accepted seats are retained without consuming capacity
again. Successful upgrades change the holding pointer and preserve the previous
allocation as UPGRADED history. Pools are updated in ObjectId order. No better
seat retains the old allocation; any exception rolls back the whole upgrade.
Final rounds can disable new upgrade requests through allowUpgrade=false.

Each year has one CounsellingCycle. Mutations write its revision inside the
transaction before reading business state. Competing writes serialize across
processes, including seed writes, preference locks, rounds and allocations. This
prioritizes correctness over maximum throughput.

SeatHolding has unique student/year and allocation indexes and updates in place
on upgrade. Initialization backfills it and retires the earlier partial unique
Allocation index. Run migrations with writers stopped. Direct database writes or
generic CRUD endpoints must not bypass these services.

Reconciliation reads a consistent snapshot and reports capacity differences,
missing pools, missing holdings and invalid holding links. It does not silently
repair data. Backup automation remains separate.

## Errors and tests

ServiceError exposes code, message and an HTTP-oriented status. Codes include
FORBIDDEN, NOT_FOUND, VERSION_CONFLICT, PREFERENCES_LOCKED, PREFERENCE_WINDOW_CLOSED,
YEAR_FROZEN, INVALID_TRANSITION, ROUND_INCOMPLETE, RANK_ORDER_REQUIRED, STALE_DECISION,
SEAT_CONFLICT and DUPLICATE_RECORD. Mongoose validation errors also propagate.
E4 must translate unexpected driver failures to generic responses without logging
connection strings or hashes.

`createDbmsEngine({ clock, checkpoint })` supports deterministic testing and injected
failures. Production callers should use `dbms`; never accept hooks from requests.

`npm test` runs offline. `npm run test:integration` uses a random temporary Atlas
database, deleted in a finally block. Force-killing the process can leave that test
database for manual cleanup. No local MongoDB download or server is used.
