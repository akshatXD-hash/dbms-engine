# Source analysis and phase decisions

This project implements CounselDesk, an academic UG engineering counselling
system, in JavaScript with MongoDB/Mongoose. It is an application data and
transaction engine, not a new database server or an official KEA implementation.

## Material reviewed

- `Team12_Gate0_Doc.docx`: all seven S0 sections, stakeholder and workflow tables,
  objectives, scope, feasibility and eight project risks.
- `Team12_Gate1_Doc.docx`: engine decomposition, FR1–FR14, NFR1–NFR14, UC1–UC10,
  acceptance criteria, priorities, traceability and all four engine sheets.
  The embedded handwritten use-case diagram was also inspected.
- `WhatsApp Image 2026-10-30 at 9.04.00 AM.jpeg`: all eight entities,
  attributes and relationship cardinalities in the supplied ER diagram.

Word text and tables were extracted from OOXML in document order. A page-render
attempt failed because the bundled environment has no LibreOffice executable;
this review covers the content and embedded diagram, not Word page-layout QA.
Source files and extracted personal information are not added to Git.
Template reminders in the documents are evidence about the coursework process,
not instructions overriding the user's request to implement the schema now.

## Gate 0 findings

The core problem is consistency of scarce seats across three rounds. Last-seat
races, half-completed allotments, lost seats on failed upgrades and duplicate
requests are the central risks. Rank, eligibility and ordered choices determine
the result; a student must retain the old seat if an upgrade fails. Students and
admins are the primary users. Colleges supply capacities; the authority owns
policy. Gate 0 explicitly excludes payments, document uploads/verification,
rank generation, production deployment and exact KCET/COMEDK rules.

## Gate 1 findings

E1 owns persistence and transactions; E2 owns worker scheduling, rank-ordered
commits and retries; E3 owns merit/eligibility/preference decisions; E4 owns the
portals and request handling. A safe database alone does not guarantee merit
fairness: the future coordinator must preserve rank order under concurrency.

FR1–FR6 need identities, eligibility, catalogue data and frozen ordered choices.
FR7–FR10 need allocation records, rounds, seat pools and student history. FR13
also requires an explicit UNALLOCATED result, which the ER image cannot represent
with an allocation row alone. FR14 requires versioned configuration. FR11 and
FR12 add payments and verification beyond Gate 0's exclusions.

Performance goals (10,000 students in five minutes; 500 concurrent users),
backups, availability, encryption and login controls remain future acceptance
targets. Schema tests do not demonstrate those targets.

## Conflicts and decisions

| Issue | Phase 1 decision |
| --- | --- |
| Documents assume relational PK/FK, SQL row locks and COMMIT/ROLLBACK; user requests MongoDB | ObjectId references and unique indexes now; replica-set transactions, guarded seat updates and explicit reference validation in phase 2. No claim of SQL row locking. |
| Gate 0 excludes payments; Gate 1 FR11 and E1/E4 add them | Defer payment models and gateway integration until scope is resolved. FR10 payment portion and FR11 remain unimplemented. |
| Gate 0 excludes verification; Gate 1 FR12 requires it | Store verification status and rule requirements only. No document upload or verification workflow in phase 1. |
| Diagram has both password and password_hash | Store only a supported encoded passwordHash, excluded from default selection and object/JSON serialization. Hashing/login are later work. |
| Branch belongs to one college but has no college_id attribute | Add required college reference; same program can exist at different colleges. |
| Preference has no year/round and each row has its own lock | One Preference document per student/round with ordered embedded choices; lock the whole list atomically in phase 2. |
| Allocation references a seat pool but omits matrix_id | Store required seatMatrix reference; derive college/branch/category from the pool to avoid contradictory duplicate fields. |
| Round shows send_date | Interpret as endDate and add a separate preferenceDeadline. |
| UNALLOCATED/UNALLOTTED naming differs | Use UNALLOCATED consistently in RoundResult. |
| Three rounds vs growth requirement | Default plan is three rounds; schema permits configurable positive round numbers. |
| Duplicate rank mentioned as invalid; no tie-breaking policy | Unique rank per academic year. A tie policy must be agreed before relaxing it. |
| Category label in Student image is blurred | Use explicit category from FR2; categories and eligibility groups are codes configured by RuleSet, not assumed official reservation labels. |

## Source-to-model traceability

| Requirements | Schema foundation | Still needed |
| --- | --- | --- |
| FR1, FR2, NFR3, NFR7 | Student, Admin, hidden hash, year-scoped identifiers | Password hashing, auth, ownership checks, encryption deployment |
| FR3 | College, Branch, SeatMatrix | Search/read APIs |
| FR4, FR12, FR14 | RuleSet, verificationStatus, Round | Eligibility resolver, verification workflow, immutable rule activation |
| FR5, FR6 | Preference choices, duplicate/order validation, lock metadata | Reference checks, deadline enforcement, lock/edit service |
| FR7–FR9, NFR4–6, NFR10, NFR12, NFR14 | Allocation, SeatMatrix, Round, unique holding index | Atomic updates/rollback, release/upgrade, rank sequencing, load tests |
| FR10, NFR11 | Unique student/round allocation and result, AuditEvent | Transactional idempotency and audit writes; payments deferred |
| FR13 | RoundResult, publication timestamp | Result permissions and allotment-letter generation |
| NFR1, NFR2, NFR8 | Query indexes and separated modules | Performance/scale measurements |
| NFR9, NFR13 | No UI/auth implementation in this phase | Usability study, brute-force protection |

## Reference structure

The actual [Flexio tree](https://github.com/akshatXD-hash/flexio) uses `backend/`
and `frontend/`, with `backend/config`, `controllers`, `middlewares`, `models`
and `routes`. Its README's `client/server` example differs from the actual tree;
this project follows the tree and adds services, scripts, tests and docs.
