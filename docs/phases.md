# Implementation phases

## Phase 1 — schema foundation (complete)

All three source files were reviewed. The initial eleven models, fixtures,
offline tests and synthetic student generator were implemented.

## Phase 2 — E1 transaction services (implemented)

Reference checks, configuration, preferences, rank-ordered allocation, acceptance,
release, upgrade, round transitions, results, auditing and reconciliation are now
implemented. CounsellingCycle and SeatHolding extend the schema to thirteen models.
Atlas integration tests cover real transactions and three rounds. The engine uses
the existing cluster; no local MongoDB download is required.

The coordinator serializes mutations per academic year. Rank, eligibility and
capacity freeze after opening. Reservation changes use new rule versions for later
rounds. Performance targets remain unmeasured.

## Phase 3 — E2 and E3 integration

Integrate bounded workers, retries, cancellation, progress tracking and optimized
merit/preference logic through `backend/services/index.js`. Preserve rank order and
E1's authoritative checks. Measure 10,000-student and 500-user targets. The current
selector and coordinator provide a correctness baseline.

## Phase 4 — E4 authentication and portals

Implement login, role middleware, session expiry, rate limiting, HTTP routes,
React dashboards and allotment letters. Construct actors from authenticated
sessions. Resolve payment and certificate-verification scope before implementing them.

## Phase 5 — operational handover

Exercise backup/restore, process restart, privacy controls and usability. Define
monitoring and reconciliation procedures and complete requirements traceability.
Official counselling rules, real admissions and rank generation remain out of scope.
