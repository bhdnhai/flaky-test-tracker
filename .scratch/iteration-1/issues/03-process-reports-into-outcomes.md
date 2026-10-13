# 03 — Worker processes Reports into Tests and Outcomes

Status: resolved
Priority: must
Blocked by: 02

## Goal

Every `pending` Report is processed by the worker into Tests and Outcomes, and the Reports page shows it as `processed`.

## Requirements covered

FR-13, FR-14, FR-15, FR-16; NFR-12 (coverage gate on the JUnit module). ACs: AC-11, AC-12, AC-39 (coverage part).

## Scope

### In

- **JUnit** module (pure, no I/O): `interpret(xml)` → test cases with `classname`, `name`, result, failure message (message attribute + text of the first failure/error, truncated to 8 KB on a UTF-8 boundary); `hostname` ignored. Parse with fast-xml-parser, entities off.
- **ReportQueue** Postgres adapter: `claimNext(now)` with `FOR UPDATE SKIP LOCKED`, `complete(id, result)`. Happy path only.
- **ReportProcessing**: `processNext(now)`: claim → load content → interpret → in one transaction upsert Tests, insert Outcomes (`ON CONFLICT DO NOTHING`), set `processed`.
- `worker` entry point and Compose service (same image), polling every 500 ms, with state-change log lines.
- Migration: `test`, `outcome` (with copied `project_id`, `commit_sha`, `received_at`) and design §6 indexes.
- Unit fixtures: the prototype's real XML samples (Vitest, Playwright single and multi-project, jest-junit, retries), copied from branch `prototype/reporter-output-and-flakiness`.
- Coverage threshold ≥ 90% lines on the JUnit module, enforced in CI.

### Not in this ticket

- Collisions (08): duplicate identities in one Report may be handled naively here; 08 makes them correct. Document the gap in the module until then.
- Retries, back-off, `failed`, claim expiry (09).
- Any Flake logic (04).

## Acceptance checks

- [x] **AC-11** (FR-14, FR-15, FR-16). **Given** a Vitest Report with one passing, one `<failure>`, one `<error>` and one `<skipped>` test case, **when** it is processed, **then** 4 Tests exist with `classname`/`name` exactly as in the XML, their Outcomes are passed, failed, failed and skipped, and both failed Outcomes have a failure message.
- [x] **AC-12** (FR-16). **Given** a `<failure>` whose combined message is 20 KB of multi-byte UTF-8, **when** it is processed, **then** the stored failure message is ≤ 8 KB and is valid UTF-8.
- [x] **AC-39** (NFR-12). CI runs lint and typecheck with 0 errors, and the coverage report for the JUnit interpretation module is ≥ 90% lines.

**How to verify by hand:**

- Submit a Vitest Report as in 02; within a second the Reports page shows `processed`.
- `docker compose exec db psql -U … -c "select result, count(*) from outcome group by 1"` shows the expected counts.

## Tests expected

- **Unit:** JUnit module against every prototype sample: identity exactly as reported, failure/error → failed, skipped, the 8 KB truncation with multi-byte input (AC-11, AC-12); coverage ≥ 90% (AC-39).
- **Integration:** submit → `processNext` → Tests and Outcomes exist; the Report is `processed` (AC-11 end to end).
- **E2E:** none new (covered in 06 and 11).

## Design notes

- Modules: **JUnit** (the deepest module; keep its interface to `interpret`), **ReportQueue** (seam), **ReportProcessing**.
- ADRs: 0004, 0005 (identity, `hostname` ignored), 0006 (worker process), 0011 (queue on the `report` table).
- Design §4 module table, §6 processing transaction and indexes.

## Definition of done

- [x] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [x] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [x] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [x] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [x] README updated if setup, run or test commands changed.
- [x] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments


### 2026-10-13: resolved

**Built**
- **JUnit** module (`apps/api/src/junit/`, pure, no Nest/I/O): `interpret(xml)` → test cases with `classname`/`name` exactly as reported, `result` (passed/failed/skipped), and a failure message (message attribute + text of the first `<failure>`/`<error>`, truncated to ≤ 8 KB on a UTF-8 boundary). `hostname` ignored. Unit fixtures copied from `prototype/reporter-output-and-flakiness`'s real Vitest/Playwright/jest-junit samples (normal and retry runs).
- **ReportQueue** (`report-processing/report-queue.ts`): `claimNext(now)` via one atomic `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED) RETURNING`; `complete(tx, id, now)` inside the processing transaction. Happy path only, as scoped.
- **ReportProcessing**: `processNext(now)` — claim → load `report_content` → `interpret` → one transaction (`test.createMany({skipDuplicates})` + a lookup select, `outcome.createMany({skipDuplicates})`, `queue.complete`) → a JSON state-change log line (`reportId`, `from`, `to`, `attempt`, `durationMs`).
- `worker` entry point (`src/worker.ts`, polls every 500 ms) and its `docker compose` service (same image, `node dist/worker.js`).
- Migration `add_test_outcome_tables`: `test`, `outcome` (with `project_id`/`commit_sha`/`received_at` copied from the Report), plus the design §6 `INCLUDE` index (hand-added to the generated SQL — Prisma's schema syntax has no `INCLUDE` clause).
- Coverage gate: `apps/api/vitest.config.ts` thresholds (90% lines on `src/junit/**`), enforced by `npm run test:unit`'s `--coverage` flag — lands in the CI `unit` job per design §11.
- Tests: unit (`junit.test.ts`, 8 cases incl. AC-11/AC-12 plus every prototype fixture — 100% line coverage), integration (`report-processing.int.test.ts`: AC-11 end to end, "no pending Report" and the naive-collision case).

**Discoveries — design corrected (SRS v1.4, design §7).**
1. `fast-xml-parser`'s `processEntities: false` (as design §7 specified) turned out to be all-or-nothing: it also disables the five *predefined* XML entities (`&gt;`, `&amp;`, …), not just custom/DOCTYPE ones. Vitest's `name` attribute uses `&gt;` for its `" > "` describe separator, so this would have stored names that don't match "exactly as reported" (FR-14, AC-11) — found because the Vitest fixture's real sample name literally contains `&gt;`. Left entities enabled: the library's entity decoder already caps expansion size/depth and screens custom entity values regardless of the toggle, so NFR-07's actual concern (DOCTYPE/XXE, which ticket 07 rejects before parsing) is unaffected.
2. A Report whose root is a single bare `<testsuite>` (no `<testsuites>` wrapper) silently produced zero Tests/Outcomes while the Report still went to `processed` — found by processing a batch of already-stored Reports on the dev stack left over from earlier manual testing, which used exactly this shape (`apps/api/test/support/junit-fixtures.ts`'s `SAMPLE_JUNIT_XML`, written for ticket 02). `interpret` now accepts both shapes.

**Deliberate gaps (named in scope, not fixed here):** Collisions are handled naively — `outcome.createMany({ skipDuplicates: true })` silently drops the second test case sharing an identity in one Report, with no warning (ticket 08). No retry/back-off/`failed`/claim-expiry (ticket 09): a Report that crashes mid-processing stays `processing` forever until then.

**Out-of-scope follow-ups found (for the Operator to decide on new tickets):**
- A `<testcase>` with *both* multiple sibling `<failure>` elements and a mix of `<failure>`/`<error>` tag names isn't exercised; real reporters never mix the two tags, so this was left untested rather than guarded.
- Worth a note in the CI-setup docs (ticket 13) that both JUnit root shapes (`<testsuites>` wrapper and bare `<testsuite>`) are accepted.
