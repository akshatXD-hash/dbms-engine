# CounselDesk

JavaScript data layer for a UG engineering college seat-allocation system.
**Phase 1 is complete: MongoDB/Mongoose schema, indexes, fixtures and offline
validation.** Allocation transactions, worker scheduling, APIs and portals are
planned phases, not implemented features.

## Run locally

Use Node.js 22 or later. From the repository root:

```sh
npm ci
npm test
npm run schema:check
```

Both checks run without a MongoDB URL and do not write to any database. The
synthetic fixtures are examples, not seeded login accounts.

## Structure

```text
backend/
  config/          Environment, connection and database validator
  constants/       Workflow states
  models/          Eleven Mongoose models and shared field definitions
  controllers/     Reserved for HTTP handlers
  middlewares/     Reserved for authentication and request controls
  routes/          Reserved for API routes
  services/        Reserved for transaction and business-rule services
  fixtures/        Synthetic linked sample data
  seeds/           Student generator and local generated dataset
  scripts/         Offline validation and explicit database initialization
  tests/           Offline validation and index-declaration tests
frontend/          Portal phase notes
docs/              Analysis, schema dictionary, ER diagram and phase plan
```

This follows the actual [Flexio repository](https://github.com/akshatXD-hash/flexio)
folder structure. Source documents remain outside the repository.

## Schema

The eight ER entities map to Student, Admin, College, Branch, Preference,
SeatMatrix, Allocation and Round. RuleSet, RoundResult and AuditEvent cover the
requirements for configurable reservation rules, unallocated outcomes and history.

- [Requirements analysis and conflicts](docs/requirements-analysis.md)
- [Schema dictionary, relationships and constraints](docs/schema.md)
- [Implementation phases and acceptance checks](docs/phases.md)

## Synthetic student seed

Generate **250 synthetic students** matching the Student schema:

```sh
npm run seed:students
```

The file is written to `backend/seeds/generated/students.json` after every record
passes model validation. This default command does not connect to MongoDB.
Generated files are ignored by Git. Choose any count from 200 to 300:

```sh
npm run seed:students -- --count 300 --year 2026
```

## Connecting later

No database credentials are needed for phase 1 checks. For the database integration
phase, provide a **development** MongoDB replica-set/Atlas URL by placing it in
`backend/.env` copied from `backend/.env.example`, with an explicit database name.
Keep this file out of Git. Then run:

```sh
npm run db:init
```

This command creates missing collections, adds declared indexes and installs the
seat-capacity validator. It does not insert sample data or drop indexes. Existing
duplicate data can cause index creation to fail; correct it before rerunning.
Initialization is not an atomic migration and may partially complete on failure.
The validator also applies to future updates of existing seat-pool records; it
does not repair invalid existing records. Use a dedicated development database.

## Important phase boundary

Schema validation is not foreign-key enforcement, authorization, a preference-lock
service or a safe allocation engine. Use `await doc.validate()` for cross-field
checks; `validateSync()` does not execute the pre-validation hooks. Mongoose's
`unique` option declares an index, not a document validator. Indexes take effect
only after database initialization. See the [Mongoose validation guide](https://mongoosejs.com/docs/validation.html).

The transaction phase must recheck references and eligibility, serialize decisions
by rank and update seat counts, allocations, student state, results and audits in
one transaction. MongoDB supports [multi-document transactions on replica sets and
sharded clusters](https://www.mongodb.com/docs/manual/core/transactions/); this
project does not implement the documents' SQL row locks.

Payments are deferred because Gate 0 excludes them while Gate 1 requires them.
Verification status is modeled; document uploads and verification workflows are
not implemented. No real candidate data or official counselling policy is shipped.
