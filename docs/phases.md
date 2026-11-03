# Implementation phases

## Phase 1 — schema foundation (complete)

Read all three inputs, reconcile inconsistencies, follow the Flexio tree and
implement eleven JavaScript Mongoose models with indexes, field validation,
cross-field validation, synthetic fixtures, offline tests and explicit database
initialization tooling. Twenty focused commits capture this phase.

## Phase 2 — database integration and transaction services

Request a development MongoDB replica-set/Atlas URL when starting this phase.
The user can place it in ignored `backend/.env`; it need not be pasted into chat.
Initialize collections/indexes, then implement reference validation, rule freezing,
preference lock/deadline enforcement, allocation, release, acceptance and atomic
upgrade. Keep candidate rank ordering deterministic at the service boundary.

Acceptance evidence must include real duplicate-key rejection, raw invalid
seat-count rejection, missing/mismatched references, late/locked preference edits,
last-seat contention, rollback after every write, duplicate job replay, no-seat
outcome, retaining an old seat on failed upgrade and cross-round reconciliation.
Use a disposable test database, not the user's real candidate data.

## Phase 3 — allocation and worker orchestration

Implement E3's rank queue, preference traversal and configured quota resolver,
then E2's bounded workers, rank-ordered decisions/commits, retries, timeouts and
round recovery. Make three-round behavior the demonstration scenario. Measure
fairness, 10,000-student throughput and 500-user contention before claiming the
Gate 1 targets. Do not let workers award seats out of merit order.

## Phase 4 — authenticated APIs and portals

Add password hashing, student/admin authentication, authorization, rate limiting,
session expiry, catalogue/preferences/results APIs, administrator configuration
and the React student/admin portals. Add controlled result publication and final
allotment-letter download. Resolve payment and verification scope before building
those workflows; Gate 1's payment requirements are still open.

## Phase 5 — resilience and handover

Exercise crash/restart, stale caches, upgrades under contention, backups/restores,
privacy controls, usability and full requirement traceability. Document measured
limits and demonstrate with synthetic data. Official KEA rules, real admissions,
rank generation and production-scale rollout remain outside the academic baseline.
