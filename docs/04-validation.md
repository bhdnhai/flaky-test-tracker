# Validation: Flaky Test Tracker, iteration 1

| | |
|---|---|
| Validates | [SRS v1.7](02-srs.md), [design](03-design.md), [tickets](../.scratch/iteration-1/README.md) |
| Date | 2026-10-14 |
| Code reviewed at | `8fb03da` (HEAD, ticket 20), two-axis review re-run over `945cc04..8fb03da` (§7) |

**Legend:** ✅ met, with evidence · ⚠️ partly met, or met but not verified the way the SRS asks · ❌ not met · ⏭ deferred by decision.

**Bottom line.** The core value loop works end to end on genuinely flaky tests: Report submitted → Flakes detected → ranked list and a verdict in 2 clicks. Every Must FR is implemented and every AC has a test or a recorded measurement. Nothing is ❌. All of the dashboard and defect gaps found by the first review (tickets 17 → 18 → 19 → 20) are now fixed and independently re-verified in this pass (full suite re-run below). Three items are still genuinely ⚠️:

1. **NFR-10** (state-change log lines): still incomplete. Ticket 21, which was scoped to fix it, was never implemented (`Status: ready-for-agent`, empty Comments, no commit) — this is not a new finding, it's the same D-07 gap, now re-confirmed against the current code with one extra detail (below).
2. **FR-34 / AC-31 and AC-39**: still need a real GitHub run. This repository has no remote, so the `dogfood` job and "CI runs lint/typecheck/coverage" have only ever been simulated locally.
3. One **new, minor finding** from this review that wasn't caught before: the Test detail page labels a column **"Run"** (`TestDetailPage.tsx:63`), which reifies the "Run" concept CONTEXT.md explicitly says iteration 1 does not have. Recorded as D-17 below.

## 1. Implemented slice and demo path

- **Built:** all 35 FRs (Must, Should and Could), across 21 tickets (16 feature tickets, 1 docs ticket, 4 post-validation fix tickets), one commit each except 19+20 (combined — see §4).
- **Stack:** NestJS `api` + `worker` + CLI over PostgreSQL 18, a React/MUI dashboard behind nginx, and shared Zod contracts. It runs with `docker compose`.

The reviewer path (UC-5, NFR-13):

```sh
docker compose up -d --build   # db → migrate → api, worker → web :8080
npm run demo                   # 10 live runs of fixtures/flaky-suite, each submitted through POST /api/v1/reports
open <printed URL>             # the demo Project's Flaky Tests page
```

Re-measured for this report on 2026-10-14 (clean `docker compose down -v` first, then rebuild): `up -d --build` took **~19 s**, `demo` took **~17 s**, about **36 s in total** from a cold volume (previous report measured 28 s with images already built — both comfortably inside NFR-13's 5-minute budget). The Flaky Tests list showed exactly the 3 flaky fixtures and not the always-failing one, confirmed directly against the API (`GET /api/v1/projects/{id}/flaky-tests`), not just visually.

The Engineer's path (UC-1): Projects → Project → type part of the Test name → click the result → the verdict is the first element of Test detail (AC-23, NFR-14).

## 2. Coverage

Test paths are relative to the repository root. "int" = integration against real PostgreSQL via Testcontainers ([ADR-0010](adr/0010-integration-tests-against-real-postgres-via-testcontainers.md)).

### 2.1 Functional requirements

| ID | P | Status | Evidence | Notes |
|---|---|---|---|---|
| FR-01 | M | ✅ | `apps/api/test/projects.int.test.ts` (AC-01, AC-02) | |
| FR-02 | M | ✅ | `apps/api/src/projects/token.test.ts`, `apps/api/test/projects.int.test.ts` | |
| FR-03 | M | ✅ | `apps/api/test/projects.int.test.ts`, `apps/api/test/report-intake.int.test.ts` (AC-03) | |
| FR-04 | M | ✅ | `apps/api/test/projects.int.test.ts` | The CLI's own exit-code path (`cli.ts:56`, `process.exitCode = await main()`) is exercised only indirectly, through `ProjectsService`'s thrown errors, not through a test that actually invokes the CLI entry point and reads its process exit code. Minor test-depth gap, not a functional one (new finding, this review). |
| FR-05 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-04) | |
| FR-06 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-03, AC-05) | |
| FR-07 | M | ✅ | `packages/contracts/src/reports.test.ts`, `apps/api/test/report-intake.int.test.ts` (AC-06) | |
| FR-08 | M | ✅ | `packages/contracts/src/reports.test.ts`, `apps/api/test/report-intake.int.test.ts`, `apps/api/test/read-api.int.test.ts` (AC-07) | Was ⚠️ (D-04: unbounded `runAttempt` overflowed to `500`). **Fixed in ticket 20**: bounded at 2³¹−1 → `400 VALIDATION_ERROR`. Re-verified in this review's integration run. |
| FR-09 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-08) | |
| FR-10 | M | ✅ | `apps/api/src/report-intake/xml-pre-check.test.ts`, `apps/api/test/report-intake.int.test.ts` (AC-09) | |
| FR-11 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-04, byte-identical) | |
| FR-12 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-10) | Race-safe: the unique violation is caught (design §6), and a genuine concurrent-duplicate-submission test confirms it beyond AC-10's literal (sequential) wording. |
| FR-13 | M | ✅ | `apps/api/test/report-intake.int.test.ts`, `apps/api/test/report-processing.int.test.ts` (AC-18) | |
| FR-14 | M | ✅ | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` (AC-11, AC-15) | `<testsuite hostname>` confirmed never read (ADR-0005). |
| FR-15 | M | ✅ | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` (AC-11) | |
| FR-16 | M | ✅ | `apps/api/src/junit/junit.test.ts` (AC-11, AC-12) | |
| FR-17 | M | ✅ | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` (AC-14, AC-15) | The warning is stored, returned by the API, **and now shown with its fix text on the Reports page** (ticket 19, see FR-30). |
| FR-18 | M | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-16) | |
| FR-19 | M | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-13) | Was ⚠️ (D-06: the stored error was the raw exception, including server file paths). **Fixed in ticket 20**: a user-safe message is stored; the full exception goes only to the log. |
| FR-20 | C | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-32) | Negative cases (pending Report rejected, unknown ID rejected) also tested. |
| FR-21 | M | ✅ | `apps/api/test/flake-analysis.int.test.ts` (AC-19, AC-20, AC-21) | |
| FR-22 | M | ✅ | `apps/api/test/flake-analysis.int.test.ts` (AC-22) | |
| FR-23 | M | ✅ | `apps/api/test/flake-analysis.int.test.ts` (AC-22) | |
| FR-24 | M | ✅ | `packages/contracts/src/tests.test.ts`, `apps/api/test/flake-analysis.int.test.ts`, `apps/api/test/read-api.int.test.ts` (AC-23, AC-24) | Was ⚠️ (D-03: `%`/`_` acted as SQL wildcards instead of literal text). **Fixed in ticket 20**: `\`, `%`, `_` escaped, `ILIKE … ESCAPE`. Re-verified. |
| FR-25 | M | ✅ | `apps/api/test/flake-analysis.int.test.ts`, `apps/api/test/read-api.int.test.ts` (AC-25) | |
| FR-26 | M | ✅ | `apps/api/test/read-api.int.test.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-26) | |
| FR-27 | M | ✅ | `apps/api/test/read-api.int.test.ts`, `apps/web/e2e/reports.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-26) | |
| FR-28 | M | ✅ | `apps/web/e2e/test-search-and-detail.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-23) | |
| FR-29 | M | ✅ | `apps/web/e2e/test-search-and-detail.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-25) | Was ⚠️ (D-01: per-Commit passed/failed/skipped counts weren't rendered). **Fixed in ticket 19**: each Commit shows "N passed, N failed, N skipped". |
| FR-30 | M | ✅ | `apps/api/test/read-api.int.test.ts`, `apps/web/e2e/reports.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-26), `apps/api/test/report-processing.int.test.ts` (D-02) | Was ⚠️ (D-02: the Collision column showed only "Yes"; a stale `error` survived a later success). **Fixed in ticket 19**: identities and fix text shown (`reports.spec.ts:74-104`); `complete()` now clears the previous `error`. |
| FR-31 | M | ✅ | `fixtures/flaky-suite/tests/` (AC-29 code-review check), `apps/web/e2e/reviewer-demo.spec.ts` (AC-28) | Re-read in this review: flakiness comes only from `tests/support/race.ts`; no seed, env var or attempt counter anywhere in the suite. |
| FR-32 | M | ✅ | `scripts/demo.sh`, `apps/web/e2e/reviewer-demo.spec.ts` (AC-28) | Re-measured: ~17 s from a running stack, ~36 s including a cold `up --build` (§1). |
| FR-33 | M | ✅ | `README.md` "Connect your CI", `.github/actions/submit-report/`, `.github/actions/submit-report/test/submit.test.sh` (AC-30) | Was noted (D-08: `urlencode` wasn't UTF-8-safe). **Fixed in ticket 20**: byte-wise, UTF-8-safe encoding; the shell test now uses a non-ASCII branch name. |
| FR-34 | S | ⚠️ | `.github/workflows/ci.yml` (`dogfood` job), `scripts/dogfood.sh` | Still simulated locally only — this repository has no git remote, so "Re-run failed jobs" producing two attempts on the same commit (AC-31) has never been observed for real. `dogfood.sh`'s `cmd_assert` only compares the current run's own attempt number to itself; it cannot by itself prove a same-commit, different-`runAttempt` re-run. |
| FR-35 | C | ✅ | `scripts/demo-playwright.sh`, `apps/web/e2e-demo-playwright/reviewer-demo-playwright.spec.ts` (AC-33) | Run by hand (ticket 16); deliberately not part of CI. |

### 2.2 Non-functional requirements

| ID | Status | Evidence | Notes |
|---|---|---|---|
| NFR-01 | ✅ | `load/k6-submit.js` via `npm run perf:load` (AC-34) | Measured in ticket 12: p95 ≈ **79 ms** against < 300 ms, 0 non-2xx in 601 requests. Not re-run for this report (nothing on the submission path changed since). |
| NFR-02 | ✅ | `load/processing.mjs` via `npm run perf:processing` (AC-35) | p95 ≈ **876 ms** against < 5 s, 20 submissions. Not re-run for this report. |
| NFR-03 | ✅ | `load/seed-reads.mjs` via `npm run perf:reads` (AC-36) | p95 ≈ **116 / 22 / 7 ms** (Flaky Tests / search / detail) against < 500 ms. Not re-run for this report; FR-24's escaping fix (ticket 20) only adds an `ESCAPE` clause to the same indexed `ILIKE`, so no regression is expected, but this is not independently measured post-fix. |
| NFR-04 | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-16, AC-17, with a test clock) | Implemented as SRS §8 says ("claim older than 60 s"), sweep every 10 s, worst case ≈ 70 s, matching SRS v1.7's corrected wording. |
| NFR-05 | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-13, AC-18) | |
| NFR-06 | ✅ | `apps/api/src/projects/token.test.ts`, `apps/api/test/report-intake.int.test.ts`, `apps/api/test/observability.int.test.ts` (AC-05) | Was noted (D-05: the dogfood job's runtime token wasn't masked before becoming a step output). **Fixed in ticket 20**: `::add-mask::` added before the token is used; this specific line has not been observed printing an unmasked token on GitHub, because there is still no remote. |
| NFR-07 | ✅ | `apps/api/src/report-intake/xml-pre-check.test.ts`, `apps/api/test/report-intake.int.test.ts` (AC-09) | Predefined entities still decode (SRS v1.4), which is correct and doesn't affect XXE safety. |
| NFR-08 | ✅ | `eslint.config.js` (bans `dangerouslySetInnerHTML`), `apps/web/e2e/xss-safety.spec.ts` (AC-27) | |
| NFR-09 | ✅ | `apps/web/e2e/accessibility.spec.ts` (AC-37) | |
| NFR-10 | ⚠️ | `apps/api/test/observability.int.test.ts` (AC-38) | Request IDs and JSON logs are solid. State-change lines are still incomplete (D-07, ticket 21 not implemented): the claim `pending→processing` transition during normal processing *is* logged (confirmed in this review's integration-test run, which shows `"from":null,"to":"pending"` on intake), but a failed attempt always logs `to: 'processing-failed'` (`report-processing.service.ts:96`) — not a real `processingState` value, and it doesn't distinguish "retrying → pending" from "exhausted → failed". Claim expiry (`releaseExpired`) logs only an aggregate count, not one line per Report. `reprocess-report` (`requeue`) logs nothing at all — `report-queue.ts` has no `Logger` in it. |
| NFR-11 | ✅ | `apps/api/test/health.int.test.ts` (AC-38) | Re-verified by hand this review: `GET /health` returns `200 {"status":"ok"}` with the database up, and `503` within seconds of `docker compose stop db`. |
| NFR-12 | ⚠️ | `npm run lint`, `npm run typecheck`, `apps/api/vitest.config.ts` (90% threshold on `src/junit/**`) | Locally: 0 lint and type errors (re-run this review), JUnit module **100% lines, 90.5% branches**. AC-39 says "CI runs" these; `.github/workflows/ci.yml`'s jobs exist and are correctly configured but have still never run on GitHub (no remote). |
| NFR-13 | ✅ | `scripts/demo.sh`, `apps/web/e2e/reviewer-demo.spec.ts`, `apps/web/e2e/smoke.spec.ts` (AC-28) | Re-measured this review from a fully clean volume (`docker compose down -v` first): ~36 s total, well inside 5 minutes. |
| NFR-14 | ✅ | `apps/web/e2e/test-search-and-detail.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-23) | |

### 2.3 Acceptance criteria

All AC-01 … AC-39 are accounted for against their parent FR/NFR in §2.1/§2.2 above. The remaining ⚠️ items are **AC-31** (dogfood re-run, needs a real GitHub remote) and **AC-39** (CI run, same reason). **AC-26** (the flaky `reports.spec.ts` race, D-09) was fixed in ticket 18 and is re-confirmed stable in this review: 3 consecutive full E2E runs, 13/13 passed each time (§9). Nothing is ⏭: every Should and Could requirement (FR-20, FR-34, FR-35) was built. The deliberate Won'ts are in SRS §5.7.

## 3. Assumptions

| # | Assumption | Status | Evidence |
|---|---|---|---|
| A1 | Teams re-run failed jobs often enough | **Unknown** | No real repository was measured. Needs `GITHUB_RUN_ATTEMPT` data from a target team. |
| A2 | `classname` + `name` identify a Test stably | **Partially refuted → handled** | Prototype: stable across runs but not unique (Playwright multi-project, jest-junit defaults). ADR-0005 and Collision detection (AC-14, AC-15). |
| A3 | Runner differences rarely look like flakiness | **Unknown** | Needs real multi-job data. `job` is stored on every Outcome, so the check is possible. |
| A4 | A `pull_request` re-run keeps the same `GITHUB_SHA` | **Unknown** | The dogfood job is built to check it (AC-31), but still hasn't run on GitHub — no remote exists for this repository. |
| A5 | Retries are visible in JUnit output | **Partially confirmed** | Prototype: visible only when every attempt fails. Retries are not used as a signal. |
| A6 | An internal network is an acceptable boundary | **Unknown** | No security or ops review has taken place. ADR-0002 names the trigger for adding OIDC. |
| A7 | Reports stay under 10 MB | **Unknown** | 1 MB Reports and 1,000-case Reports were tested (AC-34, AC-35). No real suite was measured, and no test drives a Report near the 10 MB ceiling. |
| A8 | The completion-order race fails about 50% on any machine | **Confirmed locally** | Prototype: 35–60% on M1 and `--cpus=0.5`. Every `npm run demo` run during this assignment, including this review's, listed all 3 flaky fixtures. Not measured on GitHub Actions runners. |
| A9 | Teams act on the Collision warning | **Unknown, less weakened than before** | Needs real usage. The Reports page now shows the fix text (FR-30 fixed in ticket 19), which removes the specific weakness noted at first validation. |
| A10 | Computing Flakes on read meets NFR-03 | **Confirmed** | AC-36: p95 116 ms at 10k Tests / 200k Outcomes. The fallback was not built. |

## 4. Changes against the SRS and the design

### 4.1 Discovered during implementation (each recorded in the SRS document history)

| SRS | Change | Trigger | Where |
|---|---|---|---|
| v1.1 | An expired claim counts as an attempt. The coverage NFR is narrowed to the JUnit module. | Design: a worker-crashing Report would otherwise loop forever, and SQL can't be measured by unit coverage | SRS §8, NFR-12 |
| v1.2 | Node ≥ 22.22; `eslint-plugin-import-x`; test-naming and `fetch`-stub rules; nginx proxies `/health`; `db` on port 5433 | Ticket 01: package engine fields, ESLint 10, a host PostgreSQL on 5432 | [ticket 01](../.scratch/iteration-1/issues/01-walking-skeleton.md), design §2, §4, §8, §10 |
| v1.3 | ReportIntake is the read owner of the Report table | Ticket 02 code review: the design gave no module that role | [ticket 02](../.scratch/iteration-1/issues/02-create-project-and-submit-report.md), design §4 |
| v1.4 | Predefined XML entities decode. A bare `<testsuite>` root is accepted. | Ticket 03: Vitest's `&gt;` in names; zero Outcomes from a real Report shape | [ticket 03](../.scratch/iteration-1/issues/03-process-reports-into-outcomes.md), design §7 |
| v1.5 | nginx `client_max_body_size 10m`; A10 confirmed | Ticket 12: k6 got nginx's `413` on 1 MB Reports | [ticket 12](../.scratch/iteration-1/issues/12-performance-verification.md), design §10 |
| v1.6 | Traceability matrix synced; §13 assumption statuses updated; NFR-04 / §8 inconsistency recorded | Ticket 17 validation | SRS §13, §16, §18 |
| v1.7 | NFR-04 and AC-17 relaxed to "within 70 s" | Decision after validation: the 60 s claim expiry plus the 10 s sweep can't meet 60 s; a 10 s difference has no user impact | SRS §6, §15, §18 |

No SRS or design change was needed for tickets 18, 19 or 20 — each was a defect fix within the existing requirement text, not a requirement change. Deviations that needed no document change: Nest's global body parser turned off (ticket 07, completes design §5); the CLI keeps plain stdout because `demo.sh` parses it (ticket 10); Prisma `createMany({skipDuplicates})` instead of hand-written `ON CONFLICT` (ticket 03).

**Design-accuracy notes found by this review, not requiring an SRS/design version bump (too minor to be a "change", but worth recording so the documents don't quietly drift):**
- Design §4's module diagram draws an `intake --> queue` edge that doesn't exist in the actual import graph (`ReportIntake` never imports `ReportQueueService`; a new Report row's `pending` state is itself the enqueue, per ADR-0011). ADR-0011 already explains the implicit-enqueue reasoning, so this is a diagram-only inaccuracy, not a behavioural one.
- ADR-0008 frames raw SQL as "the two hot queries" (claim, flake aggregation); the code actually has 5 raw `$queryRaw` call sites (claim; flaky-tests, search, and two inside testDetail), all correctly scoped inside `FlakeAnalysis`/`ReportQueue` per design §4's ownership rule. The ADR's count is stale, not the architecture.

## 5. What remains

- **Fully fixed since first validation:** AC-26 (ticket 18, D-09); FR-29, FR-30 (ticket 19, D-01, D-02); FR-08, FR-24, FR-19, NFR-06, FR-33 (ticket 20, D-03, D-04, D-05, D-06, D-08); NFR-04 wording (SRS v1.7). All re-verified in this review's own test run (§9), not just carried forward.
- **Still partly met:** **NFR-10** (D-07 — ticket 21 was never implemented), **FR-34 / AC-31** and **AC-39** (both need a real GitHub remote, which this repository doesn't have).
- **New minor gap found by this review:** the "Run" column label on Test detail (D-17, §7) — a terminology slip, not a functional gap.
- **Evidence only a real GitHub remote can give:** AC-31 and A4 (push, then "Re-run failed jobs"), AC-39 in CI, and A8 on GitHub runners.
- **Assumptions that need real teams:** A1, A3, A6, A7, A9 (A9 is less weakened now that FR-30's fix text ships).

## 6. Next iteration, in value order

1. **Feedback inside CI** (problem definition non-goal 5, marked "#1 priority"): the submission response or a PR comment says "known flaky". It puts the verdict where the Engineer already is.
2. **Finish ticket 21** (NFR-10 state-change logging, D-07; the worker-loop error handling, D-10): scoped and ready, just never run.
3. **Run on a real GitHub remote** and record AC-31, A4, A8 and AC-39. This is cheap and turns four "unknown" or ⚠️ items into evidence.
4. **ReportQueue interface cleanup** (D-11): stop leaking `Prisma.TransactionClient` across the module boundary before more code grows around the current shape.
5. Fix the "Run" column label (D-17) — a five-minute terminology fix.
6. An explicit "fixed" state for a Flaky Test (problem definition open questions).
7. Retention for raw content (non-goal 10) once database size matters.

## 7. Technical debt

From the ticket 17 code review (Spec and Standards axes, parallel sub-agents, over `945cc04..0f93e66`), re-verified and extended by this review (same two-axis method, over `945cc04..8fb03da`, current HEAD). Nothing here was fixed by running this review; fixes happened in the numbered tickets below, before this review ran.

| ID | Debt | Where | Axis |
|---|---|---|---|
| D-01 | ~~Test detail doesn't render per-Commit passed/failed/skipped counts (FR-25/FR-29)~~ **Fixed by ticket 19** | `apps/web/src/features/test-detail/TestDetailPage.tsx` | Spec |
| D-02 | ~~Reports page: the Collision warning shows only "Yes". `complete()` never clears an earlier attempt's `error`.~~ **Fixed by ticket 19** | `apps/web/src/features/reports/ReportsPage.tsx`, `apps/api/src/report-processing/report-queue.ts` | Spec |
| D-03 | ~~Search doesn't escape `%`/`_` before `ILIKE`~~ **Fixed by ticket 20** | `apps/api/src/flake-analysis/flake-analysis.service.ts` | Spec |
| D-04 | ~~`runAttempt` is unbounded, so an overflow gives `500`~~ **Fixed by ticket 20** | `packages/contracts/src/reports.ts` | Spec |
| D-05 | ~~The dogfood token isn't masked (`::add-mask::`) before it becomes a step output~~ **Fixed by ticket 20** | `scripts/dogfood.sh`, `.github/workflows/ci.yml` | Spec (NFR-06) |
| D-06 | ~~A failed Report stores raw exception text, including server file paths from Prisma~~ **Fixed by ticket 20** | `apps/api/src/report-processing/report-processing.service.ts` | Spec (§9.1 spirit) |
| D-07 | NFR-10 state-change lines are incomplete or mislabelled: a failed attempt logs `to: 'processing-failed'` (`report-processing.service.ts:96`), which is not a `processingState` value and conflates "will retry" with "exhausted"; `releaseExpired` logs one aggregate count instead of a line per Report; `requeue` in `report-queue.ts` logs nothing — the file has no `Logger` at all. **Still open: ticket 21, scoped to fix exactly this, was never implemented** (`.scratch/iteration-1/issues/21-state-change-logging-and-worker-resilience.md` is `Status: ready-for-agent` with an empty Comments section). Re-confirmed present at `8fb03da`. | `report-processing.service.ts`, `report-queue.ts`, `cli.ts` | Spec |
| D-08 | ~~`urlencode` in the composite action isn't UTF-8-safe~~ **Fixed by ticket 20** | `.github/actions/submit-report/submit.sh` | Spec |
| D-09 | ~~The AC-26 E2E test races the worker (seen in tickets 04, 06 and 11, and again at first validation)~~ **Fixed by ticket 18**: asserts the terminal `processed` state via `toPass` instead of transient `pending`. Re-confirmed stable in this review: 3 consecutive full `test:e2e` runs, 13/13 passed each time. | `apps/web/e2e/reports.spec.ts` | Test |
| D-10 | The worker loop doesn't catch errors from the database during claim/`fail`, so the process exits (Compose restarts it). **Still open** — same ticket 21 as D-07, never implemented. | `apps/api/src/worker.ts` | Spec (minor) |
| D-11 | The ReportQueue seam leaks `Prisma.TransactionClient` and an extra `attempts` parameter beyond design §4's declared interface (`complete(id, result)` / `fail(id, error, now)`), and lives inside `report-processing/` rather than as its own module. Re-confirmed at `8fb03da`: `complete(tx: Prisma.TransactionClient, reportId, now, collisionWarning?)` (`report-queue.ts:80`) and `fail(reportId, error, attempts, now)` (`report-queue.ts:103`) both still leak beyond the documented interface, and the transaction object now crosses into `ReportProcessingService` (`report-processing.service.ts:70`). **Still open.** | `report-queue.ts`, `cli.ts` | Standards |
| D-12 | Time isn't injected everywhere: `new Date()` in `ProjectsService` and the read controllers. Re-confirmed still present (`projects.service.ts`, `read-api/flaky-tests.controller.ts`, `read-api/tests.controller.ts`). **Still open.** | `projects.service.ts`, `read-api/*.controller.ts` | Standards |
| D-13 | Duplication: `isUniqueConstraintViolation` ×2 (`projects.service.ts`, `report-intake.service.ts`), `requireProject`/equivalent ×3 (`reports.controller.ts`, `tests.controller.ts`, inlined in `flaky-tests.controller.ts`), the Flake `HAVING` predicate ×3 (`flake-analysis.service.ts`), the "3 attempts" and "60 s" literals repeated without named constants in `report-queue.ts`. Re-confirmed present. **Still open.** | various | Standards (smell) |
| D-14 | Test names without an ID: two FR-20 tests (`report-processing.int.test.ts:473,486`) and the four per-page AC-37 tests (the ID is only on their `describe`, `accessibility.spec.ts:44,50,57,66`). Re-confirmed present. **Still open.** | `report-processing.int.test.ts`, `accessibility.spec.ts` | Standards |
| D-15 | `npm audit` reports high findings, transitive in the `prisma` CLI. The only offered fix downgrades below ADR-0008's version. | `package-lock.json` | Ticket 01 |
| D-16 | SRS §9.1 has no code for `403`/`405`/`429`. The filter maps them to `500`. Low impact: no code path in the app currently produces those statuses (no RBAC, no rate limiting built, per ADR-0002/SRS §14). | `apps/api/src/platform/` | Ticket 01 |
| D-17 | **New, found by this review.** Test detail's history table labels a column **"Run"** (`TestDetailPage.tsx:63`), which shows `runId`/`runAttempt`. CONTEXT.md is explicit that "Run... is deliberately not a concept" in iteration 1 — only the CI run ID is an attribute of a Report. The Reports page avoids this correctly, labelling the equivalent column "Run attempt" (`ReportsPage.tsx:51`). A terminology slip, not a functional defect; the underlying data and API field names (`runId`, `runAttempt`) are correct and consistent with the glossary. | `apps/web/src/features/test-detail/TestDetailPage.tsx` | Standards (terminology) |

Small smells noted and accepted, unchanged since first validation: nested ternaries in `FlakyTestsPage.tsx`, the `result` field name (CONTEXT.md lists "result" under Outcome's *Avoid*, but the DB column and the SRS use it), and pass-through row mappers in the read controllers.

## 8. Risks towards production

| Risk | Likelihood / impact | Mitigation today | Next step |
|---|---|---|---|
| Failure messages contain secrets or personal data, stored unredacted (SRS §10) | Medium / high | Internal-network boundary; 8 KB truncation; stored error text is now user-safe, not a raw exception (ticket 20, D-06) | Redaction rules; retention |
| Dashboard without login (A6) | Depends on the network / high | ADR-0002 precondition; only the submission route public | OIDC if A6 is refuted |
| Public submission route without rate limiting | Low / medium | Per-Project, rotatable tokens | WAF rate limit (design §10 sketch) |
| Unbounded growth of raw content in `bytea` | Certain / medium over time | Small volume (SRS §11) | Retention; move to S3 (ADR-0012) |
| One worker and one database, no backups | Certain / medium | Submissions survive worker loss (NFR-05); the worker still exits (not crashes gracefully) on a DB error during claim/fail (D-10) | RDS backups; fix D-10; a second worker is safe with `SKIP LOCKED` |
| False verdicts from environment differences (A3) or a changing SHA on re-run (A4) | Unknown / high for trust | `job` and `runAttempt` stored as evidence | Measure A3/A4 on real data (needs a GitHub remote) |
| Operational visibility into processing is incomplete (NFR-10, D-07) | Medium / medium | Request IDs and JSON logs are solid; only state-change granularity is missing | Finish ticket 21 |
| Transitive `prisma` CLI vulnerabilities (D-15) | Low (dev/migrate only) / medium | Not in the runtime request path | Upgrade when patched |
| Performance numbers come from one laptop run each, not re-run since ticket 12 | Medium / low | Large headroom (≥ 4×) measured; code touched since (FR-24 escaping) is unlikely to regress it | Re-run `perf:*` on target hardware, and after any read-path change |

## 9. Test summary

Run on 2026-10-14 at `8fb03da` (Apple M1, Node 22.23, Docker 27.4) — a fresh, full re-run for this report, not carried forward from ticket 17:

| Suite | Command | Result |
|---|---|---|
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Typecheck | `npm run typecheck` | 0 errors (contracts, api, web) |
| Unit | `npm run test:unit` | **41 passed** (contracts 10, api 24, web 7). JUnit module coverage **100% lines, 90.5% branches** |
| Integration | `npm run test:integration` | **70 passed** (7 files, Testcontainers PostgreSQL), plus the AC-30 action test ok |
| Demo | `docker compose down -v && docker compose up -d --build && npm run demo` | ~19 s up, ~17 s demo, ~36 s total from a cold volume; 3 flaky fixtures listed via the API, the always-failing one not |
| E2E | `npm run test:e2e` × 3 after the demo above | **13/13 passed, all 3 runs** (the D-09 race fix holds) |
| Health | manual: `curl /health`, then `docker compose stop db` | `200 {"status":"ok"}` → `503` within seconds, confirmed by hand |
| Performance | `npm run perf:load`, `perf:processing`, `perf:reads` | **Not re-run for this report.** Numbers below are ticket 12's, carried forward: p95 submission 79 ms (<300), processing 876 ms (<5000), reads 116/22/7 ms (<500) |
| Playwright demo | `npm run demo:playwright` | Ticket 16, by hand; not re-run |

**What the tests do not cover:** the CLI's own exit-code contract isn't exercised through the actual CLI entry point (FR-04, new finding, §2.1); NFR-10's log-line correctness has no test asserting the exact `from`/`to` values for every transition (which is exactly how D-07 stayed open); AC-31's real GitHub re-run behaviour and AC-39's actual CI execution are unverifiable without a remote; performance tests were not re-run against the code currently at HEAD, only against ticket 12's commit.

## 10. Traceability walk-through

Three requirements followed from problem to test, to check the links:

| Requirement | Problem → SRS | Design / ADR | Ticket → commit | Test |
|---|---|---|---|---|
| Flake rule (FR-21) | [Value](01-problem-definition.md#value) → [FR-21, AC-19…21](02-srs.md#54-analysis) | [ADR-0004](adr/0004-flakiness-means-mixed-outcomes-on-the-same-commit.md), design §6 | [04](../.scratch/iteration-1/issues/04-flaky-tests-list.md) → `c2da33b` | `apps/api/test/flake-analysis.int.test.ts` |
| Collisions (FR-17) | [Scope / Analysis](01-problem-definition.md#scope-iteration-1) → [FR-17, AC-14](02-srs.md#53-processing) | [ADR-0005](adr/0005-test-identity-is-classname-and-name-with-collision-detection.md), design §4 (JUnit) | [08](../.scratch/iteration-1/issues/08-collision-detection.md) → `f61377d` | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` |
| Reviewer demo (NFR-13) | [Success criterion 4](01-problem-definition.md#success-criteria) → [NFR-13, AC-28](02-srs.md#6-non-functional-requirements) | design §10 | [06](../.scratch/iteration-1/issues/06-reviewer-demo.md) → `e82578d` | `apps/web/e2e/reviewer-demo.spec.ts` |
