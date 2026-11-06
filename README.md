# CounselDesk

JavaScript/Mongoose DBMS engine for engineering college seat allocation. The schema
and E1 transaction services are implemented. E2 workers, E3 optimizations and E4's
authenticated HTTP APIs and portals are separate integration phases.

## Setup

Use Node.js 22 or later:

```sh
npm ci
npm test
npm run schema:check
```

Configure your existing Atlas connection in ignored `backend/.env`, using
`backend/.env.example`. No local MongoDB installation or download is needed.

```sh
npm run db:init
npm run test:integration
```

The integration suite creates a randomly named `counseldesk_test_*` database on
Atlas and deletes only that database when finished. It exercises real transactions,
rollback, duplicate requests, rank checks, release, upgrade and three rounds.
Your database user needs permission to create and drop that temporary database.

Initialization must run with application writers stopped. It adds the 13 model
collections/indexes and the seat-capacity validator. It backfills SeatHolding
records from active phase 1 allocations and retires only the old
`one_held_seat_per_student_year` partial Allocation index. Conflicting holdings
stop migration. Initialization is not atomic; resolve conflicts before rerunning.

## Implemented services

- Administrator-managed students, verification, colleges, branches, rules and pools.
- Reference validation, preference editing with version checks, locking and deadlines.
- Rank-ordered allocation with eligibility and authoritative vacancy checks.
- Atomic acceptance, release and upgrade, preserving the old seat on failure.
- Repeat-safe allocation results and seat decisions.
- Round transitions and complete-result publication.
- Audit history, published results and seat-count reconciliation.

Read the [service integration guide](docs/dbms-services.md) before connecting E2,
E3 or E4. Actors must come from trusted sessions, never browser request bodies.

## Structure

```text
backend/
  config/          Connection, initialization and database validation
  constants/       Workflow states
  models/          Thirteen Mongoose schemas
  services/        E1 transaction and data services
  controllers/     Reserved for E4 HTTP handlers
  middlewares/     Reserved for E4 authentication
  routes/          Reserved for E4 API routes
  fixtures/        Synthetic schema examples
  seeds/           Student generator and local generated data
  scripts/         Initialization, validation and demo setup
  tests/           Offline and Atlas integration tests
frontend/          Portal phase notes
docs/              Requirements, schema, services and phases
```

The layout follows the actual [Flexio repository](https://github.com/akshatXD-hash/flexio).
One repository and database are shared by the modules.

## Synthetic data

Generate a local file with 250 students, or choose 200–300:

```sh
npm run seed:students
npm run seed:students -- --count 300 --year 2026
```

Output is `backend/seeds/generated/students.json`, ignored by Git. Default data
has 200 verified, 25 pending and 25 rejected students, unique identities/ranks,
and independently salted bcrypt hashes of random discarded passwords. These are
allocation-test records, not shared login accounts. Categories are illustrative.

```sh
npm run seed:students -- --write
npm run seed:counselling
```

The second command initializes the complete demonstration catalogue: the local
student file (or 250 generated students if absent), two colleges, six branches,
30 category pools with 150 seats, one synthetic administrator/rule set, and three
draft rounds. Dates are relative to the first setup run. Preferences and allocation
results are not fabricated; submit choices and execute services to produce them.

Seed writes preserve existing records and timestamps. Email/rank conflicts roll
back the student batch. Seeds refuse changes after a round opens. Full demo setup
spans several operations and can be rerun after interruption; it does not reset
vacancies or overwrite existing records. Use a dedicated development database.

## Limits

Mutations are serialized per academic year for correctness. The 10,000-student and
500-user performance targets have not been measured. Authentication, HTTP routes,
frontend, allotment letters, backup automation and deployment remain separate.
Rank, eligibility and capacities freeze once counselling opens. Later-round rule
changes require a new RuleSet version. Payments and certificate-review workflows
remain pending the Gate 0/Gate 1 scope decision.

- [Source analysis](docs/requirements-analysis.md)
- [Schema dictionary](docs/schema.md)
- [Remaining phases](docs/phases.md)
