# Validation: Flaky Test Tracker, iteration 1

| | |
|---|---|
| Validates | [SRS v1.6](02-srs.md), [design](03-design.md), [tickets](../.scratch/iteration-1/README.md) |
| Date | 2026-10-14 |
| Code reviewed at | `0f93e66` (ticket 16), two-axis review: Spec and Standards (§7) |

**Legend:** ✅ met, with evidence · ⚠️ partly met, or met but not verified the way the SRS asks · ❌ not met · ⏭ deferred by decision.

**Bottom line.** The core value loop works end to end on genuinely flaky tests: Report submitted → Flakes detected → ranked list and a verdict in 2 clicks. Every Must FR is implemented and every AC has a test or a recorded measurement. Nothing is ❌. 12 items are ⚠️, for three reasons:

1. Four dashboard and logging details are incomplete: FR-29 per-Commit counts, FR-30 Collision text, NFR-10 state-change logging, FR-24 wildcard escaping. *(After validation: all but NFR-10 fixed in tickets 19–20.)*
2. Some checks need a real GitHub run, and this repository has no remote: AC-31 and AC-39 in CI.
3. Some edge cases fail: `runAttempt` overflow, the NFR-04 timing wording (resolved in SRS v1.7), a token in the dogfood job's log. *(After validation: all fixed in ticket 20 and SRS v1.7.)*

---

## 1. Implemented slice and demo path

- **Built:** all 35 FRs (Must, Should and Could), across 16 tickets, one commit each (`d1732b8` … `0f93e66`).
- **Stack:** NestJS `api` + `worker` + CLI over PostgreSQL 18, a React/MUI dashboard behind nginx, and shared Zod contracts. It runs with `docker compose`.

The reviewer path (UC-5, NFR-13):

```sh
docker compose up -d --build   # db → migrate → api, worker → web :8080
npm run demo                   # 10 live runs of fixtures/flaky-suite, each submitted through POST /api/v1/reports
open <printed URL>             # the demo Project's Flaky Tests page
```

Measured on 2026-10-14 (Apple M1, images already built): `up` took 13 s and `demo` 15 s, **28 s in total**. The Flaky Tests list showed the 3 flaky fixtures and not the always-failing one.

The Engineer's path (UC-1): Projects → Project → type part of the Test name → click the result → the verdict is the first element of Test detail (AC-23, NFR-14).

## 2. Coverage

Test paths are relative to the repository root. "int" = integration against real PostgreSQL via Testcontainers ([ADR-0010](adr/0010-integration-tests-against-real-postgres-via-testcontainers.md)).

### 2.1 Functional requirements

| ID | P | Status | Evidence | Notes |
|---|---|---|---|---|
| FR-01 | M | ✅ | `apps/api/test/projects.int.test.ts` (AC-01, AC-02) | |
| FR-02 | M | ✅ | `apps/api/src/projects/token.test.ts`, `apps/api/test/projects.int.test.ts` | |
| FR-03 | M | ✅ | `apps/api/test/projects.int.test.ts`, `apps/api/test/report-intake.int.test.ts` (AC-03) | |
| FR-04 | M | ✅ | `apps/api/test/projects.int.test.ts` | |
| FR-05 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-04) | |
| FR-06 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-03, AC-05) | |
| FR-07 | M | ✅ | `packages/contracts/src/reports.test.ts`, `apps/api/test/report-intake.int.test.ts` (AC-06) | |
| FR-08 | M | ✅ | `packages/contracts/src/reports.test.ts`, `apps/api/test/report-intake.int.test.ts`, `apps/api/test/read-api.int.test.ts` (AC-07) | `runAttempt` has no upper bound. A value above 2³¹−1 passes Zod, overflows the `int` column and returns `500` instead of `400 VALIDATION_ERROR` (D-04). **Fixed after validation (ticket 20, D-04): bounded at 2³¹−1 → `400 VALIDATION_ERROR`.** |
| FR-09 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-08) | |
| FR-10 | M | ✅ | `apps/api/src/report-intake/xml-pre-check.test.ts`, `apps/api/test/report-intake.int.test.ts` (AC-09) | |
| FR-11 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-04, byte-identical) | |
| FR-12 | M | ✅ | `apps/api/test/report-intake.int.test.ts` (AC-10) | Race-safe: the unique violation is caught (design §6). |
| FR-13 | M | ✅ | `apps/api/test/report-intake.int.test.ts`, `apps/api/test/report-processing.int.test.ts` (AC-18) | |
| FR-14 | M | ✅ | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` (AC-11, AC-15) | |
| FR-15 | M | ✅ | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` (AC-11) | |
| FR-16 | M | ✅ | `apps/api/src/junit/junit.test.ts` (AC-11, AC-12) | |
| FR-17 | M | ✅ | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` (AC-14, AC-15) | The warning is stored and returned by the API. It isn't shown in full on the page: see FR-30. |
| FR-18 | M | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-16) | |
| FR-19 | M | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-13) | The stored error is the raw exception message, for example a Prisma message that includes a server source path (D-06). |
| FR-20 | C | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-32) | |
| FR-21 | M | ✅ | `apps/api/test/flake-analysis.int.test.ts` (AC-19, AC-20, AC-21) | |
| FR-22 | M | ✅ | `apps/api/test/flake-analysis.int.test.ts` (AC-22) | |
| FR-23 | M | ✅ | `apps/api/test/flake-analysis.int.test.ts` (AC-22) | |
| FR-24 | M | ✅ | `packages/contracts/src/tests.test.ts`, `apps/api/test/flake-analysis.int.test.ts`, `apps/api/test/read-api.int.test.ts` (AC-23, AC-24) | `%` and `_` in the query aren't escaped before `ILIKE`, so they act as wildcards rather than literal "contains" text (D-03). **Fixed after validation (ticket 20, D-03): `\`, `%`, `_` escaped, `ILIKE … ESCAPE`.** |
| FR-25 | M | ✅ | `apps/api/test/flake-analysis.int.test.ts`, `apps/api/test/read-api.int.test.ts` (AC-25) | |
| FR-26 | M | ✅ | `apps/api/test/read-api.int.test.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-26) | |
| FR-27 | M | ✅ | `apps/api/test/read-api.int.test.ts`, `apps/web/e2e/reports.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-26) | |
| FR-28 | M | ✅ | `apps/web/e2e/test-search-and-detail.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-23) | |
| FR-29 | M | ✅ | `apps/web/e2e/test-search-and-detail.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-25) | The page doesn't render the per-Commit passed/failed/skipped **counts** that FR-25 lists. The API returns them (D-01). **Fixed after validation (ticket 19, D-01): each Commit shows "N passed, N failed, N skipped".** |
| FR-30 | M | ✅ | `apps/api/test/read-api.int.test.ts`, `apps/web/e2e/reports.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-26), `apps/api/test/report-processing.int.test.ts` (D-02) | The Collision warning column shows only "Yes", not the identities and the fix (FR-17, UC-3). A Report that fails one attempt and then succeeds keeps showing the old `error` (D-02). **Fixed after validation (ticket 19, D-02): identities and fix text shown; `complete()` clears the old error.** |
| FR-31 | M | ✅ | `fixtures/flaky-suite/tests/` (AC-29 code-review check, ticket 06 Comments), `apps/web/e2e/reviewer-demo.spec.ts` (AC-28) | |
| FR-32 | M | ✅ | `scripts/demo.sh`, `apps/web/e2e/reviewer-demo.spec.ts` (AC-28) | Measured: 28 s (§1). |
| FR-33 | M | ✅ | `README.md` "Connect your CI", `.github/actions/submit-report/`, `.github/actions/submit-report/test/submit.test.sh` (AC-30) | `urlencode` encodes non-ASCII characters by code point, not as UTF-8 bytes, so a non-ASCII branch name arrives garbled (D-08). |
| FR-34 | S | ⚠️ | `.github/workflows/ci.yml` (`dogfood` job), `scripts/dogfood.sh` | Simulated locally only. It has never run on GitHub, because there is no remote (AC-31). |
| FR-35 | C | ✅ | `scripts/demo-playwright.sh`, `apps/web/e2e-demo-playwright/reviewer-demo-playwright.spec.ts` (AC-33) | Run by hand (ticket 16); deliberately not part of CI. |

### 2.2 Non-functional requirements

| ID | Status | Evidence | Notes |
|---|---|---|---|
| NFR-01 | ✅ | `load/k6-submit.js` via `npm run perf:load` (AC-34) | Measured once (ticket 12): p95 ≈ **79 ms** against < 300 ms, 0 non-2xx in 601 requests. |
| NFR-02 | ✅ | `load/processing.mjs` via `npm run perf:processing` (AC-35) | p95 ≈ **876 ms** against < 5 s, 20 submissions. |
| NFR-03 | ✅ | `load/seed-reads.mjs` via `npm run perf:reads` (AC-36) | p95 ≈ **116 / 22 / 7 ms** (Flaky Tests / search / detail) against < 500 ms. |
| NFR-04 | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-16, AC-17, with a test clock) | Implemented as SRS §8 says ("claim older than 60 s"), with the sweep every 10 s, so the worst case is about 70 s. The SRS contradicted itself (§4.1); resolved after validation in SRS v1.7 by relaxing NFR-04 to "within 70 s". |
| NFR-05 | ✅ | `apps/api/test/report-processing.int.test.ts` (AC-13, AC-18) | |
| NFR-06 | ✅ | `apps/api/src/projects/token.test.ts`, `apps/api/test/report-intake.int.test.ts`, `apps/api/test/observability.int.test.ts` (AC-05) | The product meets it. The `dogfood` CI job passes its runtime token through an unmasked step output into `with: token:`, so GitHub would print it in the job log (D-05). That token belongs to a throwaway in-job deployment. **Fixed after validation (ticket 20, D-05): `::add-mask::` before the token becomes a step output; unverified on GitHub until the push.** |
| NFR-07 | ✅ | `apps/api/src/report-intake/xml-pre-check.test.ts`, `apps/api/test/report-intake.int.test.ts` (AC-09) | Predefined entities still decode (SRS v1.4). |
| NFR-08 | ✅ | `eslint.config.js` (bans `dangerouslySetInnerHTML`), `apps/web/e2e/xss-safety.spec.ts` (AC-27) | |
| NFR-09 | ✅ | `apps/web/e2e/accessibility.spec.ts` (AC-37) | |
| NFR-10 | ⚠️ | `apps/api/test/observability.int.test.ts` (AC-38) | Request IDs and JSON logs are in place. State-change lines are incomplete: the claim `pending→processing` isn't logged; failures log `to: "processing-failed"` instead of `pending`/`failed`; claim expiry logs only a count; `reprocess-report` logs nothing (D-07). |
| NFR-11 | ✅ | `apps/api/test/health.int.test.ts` (AC-38) | |
| NFR-12 | ⚠️ | `npm run lint`, `npm run typecheck`, `apps/api/vitest.config.ts` (90% threshold on `src/junit/**`) | Locally: 0 lint and type errors, JUnit module **100% lines**. AC-39 says "CI runs" these. The `.github/workflows/ci.yml` jobs exist but have never run on GitHub (no remote). |
| NFR-13 | ✅ | `scripts/demo.sh`, `apps/web/e2e/reviewer-demo.spec.ts`, `apps/web/e2e/smoke.spec.ts` (AC-28) | 28 s with images already built. A truly fresh clone was not re-timed for this report; ticket 06 measured about 20 s for the demo. |
| NFR-14 | ✅ | `apps/web/e2e/test-search-and-detail.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` (AC-23) | |

### 2.3 Acceptance criteria

| AC | Status | Test |
|---|---|---|
| AC-01 | ✅ | `apps/api/test/projects.int.test.ts`, `apps/api/src/projects/token.test.ts` |
| AC-02 | ✅ | `apps/api/test/projects.int.test.ts` |
| AC-03 | ✅ | `apps/api/test/projects.int.test.ts`, `apps/api/test/report-intake.int.test.ts` |
| AC-04 | ✅ | `apps/api/test/report-intake.int.test.ts` |
| AC-05 | ✅ | `apps/api/test/report-intake.int.test.ts`, `apps/api/test/observability.int.test.ts` |
| AC-06 | ✅ | `packages/contracts/src/reports.test.ts`, `apps/api/test/report-intake.int.test.ts` |
| AC-07 | ✅ | `packages/contracts/src/reports.test.ts`, `apps/api/test/report-intake.int.test.ts`, `apps/api/test/read-api.int.test.ts` |
| AC-08 | ✅ | `apps/api/test/report-intake.int.test.ts` |
| AC-09 | ✅ | `apps/api/src/report-intake/xml-pre-check.test.ts`, `apps/api/test/report-intake.int.test.ts` |
| AC-10 | ✅ | `apps/api/test/report-intake.int.test.ts` |
| AC-11 | ✅ | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` |
| AC-12 | ✅ | `apps/api/src/junit/junit.test.ts` |
| AC-13 | ✅ | `apps/api/test/report-processing.int.test.ts` |
| AC-14 | ✅ | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` |
| AC-15 | ✅ | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` |
| AC-16 | ✅ | `apps/api/test/report-processing.int.test.ts` |
| AC-17 | ✅ | `apps/api/test/report-processing.int.test.ts` (test clock, no real worker kill) |
| AC-18 | ✅ | `apps/api/test/report-processing.int.test.ts` |
| AC-19 | ✅ | `apps/api/test/flake-analysis.int.test.ts` |
| AC-20 | ✅ | `apps/api/test/flake-analysis.int.test.ts` |
| AC-21 | ✅ | `apps/api/test/flake-analysis.int.test.ts` |
| AC-22 | ✅ | `apps/api/test/flake-analysis.int.test.ts` |
| AC-23 | ✅ | `apps/web/e2e/test-search-and-detail.spec.ts`, `apps/web/e2e/core-workflow.spec.ts` |
| AC-24 | ✅ | `packages/contracts/src/tests.test.ts`, `apps/api/test/read-api.int.test.ts` |
| AC-25 | ✅ | `apps/api/test/flake-analysis.int.test.ts`, `apps/web/e2e/core-workflow.spec.ts` |
| AC-26 | ✅ | `apps/web/e2e/core-workflow.spec.ts`, `apps/web/e2e/reports.spec.ts` (fixed by ticket 18: waits for the terminal `processed` state instead of asserting transient `pending`; 10/10 runs passed, plus a clean full-suite run; D-09 fixed) |
| AC-27 | ✅ | `apps/web/e2e/xss-safety.spec.ts` |
| AC-28 | ✅ | `apps/web/e2e/reviewer-demo.spec.ts` after `npm run demo` |
| AC-29 | ✅ | Code-review checklist: `fixtures/flaky-suite/tests/` was read in ticket 06 and again in this review. The flakiness comes only from `tests/support/race.ts`. |
| AC-30 | ✅ | `.github/actions/submit-report/test/submit.test.sh` (stub server) |
| AC-31 | ⚠️ | `.github/workflows/ci.yml` `dogfood` + `scripts/dogfood.sh assert`. Simulated locally with two attempts; never re-run on GitHub. |
| AC-32 | ✅ | `apps/api/test/report-processing.int.test.ts` |
| AC-33 | ✅ | `apps/web/e2e-demo-playwright/reviewer-demo-playwright.spec.ts`, run by `scripts/demo-playwright.sh` (by hand) |
| AC-34 | ✅ | `load/k6-submit.js` (measured, §2.2) |
| AC-35 | ✅ | `load/processing.mjs` (measured) |
| AC-36 | ✅ | `load/seed-reads.mjs` (measured) |
| AC-37 | ✅ | `apps/web/e2e/accessibility.spec.ts` |
| AC-38 | ✅ | `apps/api/test/observability.int.test.ts`, `apps/api/test/health.int.test.ts` |
| AC-39 | ⚠️ | Holds locally (§8). Not yet observed in GitHub Actions. |

Nothing is ⏭: every Should and Could requirement (FR-20, FR-34, FR-35) was built. The deliberate Won'ts are in SRS §5.7.

## 3. Assumptions

| # | Assumption | Status | Evidence |
|---|---|---|---|
| A1 | Teams re-run failed jobs often enough | **Unknown** | No real repository was measured. This needs `GITHUB_RUN_ATTEMPT` data from a target team. |
| A2 | `classname` + `name` identify a Test stably | **Partially refuted → handled** | Prototype: stable across runs but not unique (Playwright multi-project, jest-junit defaults). ADR-0005 and Collision detection (AC-14, AC-15). |
| A3 | Runner differences rarely look like flakiness | **Unknown** | Needs real multi-job data. `job` is stored on every Outcome, so the check is possible. |
| A4 | A `pull_request` re-run keeps the same `GITHUB_SHA` | **Unknown** | The dogfood job is built to check it (AC-31), but it hasn't run on GitHub. |
| A5 | Retries are visible in JUnit output | **Partially confirmed** | Prototype: visible only when every attempt fails. Retries are not used as a signal. |
| A6 | An internal network is an acceptable boundary | **Unknown** | No security or ops review has taken place. ADR-0002 names the trigger for adding OIDC. |
| A7 | Reports stay under 10 MB | **Unknown** | 1 MB Reports and 1,000-case Reports were tested (AC-34, AC-35). No real suite was measured, and no test drives a Report near the 10 MB ceiling. |
| A8 | The completion-order race fails about 50% on any machine | **Confirmed locally** | Prototype: 35–60% on M1 and `--cpus=0.5`. Every `npm run demo` on 2026-10-14 listed all 3 flaky fixtures. Not measured on GitHub Actions. |
| A9 | Teams act on the Collision warning | **Unknown** | Needs usage. It's also weakened by FR-30's gap: the page doesn't show the fix text yet. |
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
| v1.6 | Traceability matrix synced; §13 assumption statuses updated; NFR-04 / §8 inconsistency recorded (below) | This validation | SRS §13, §16, §18 |
| v1.7 | NFR-04 and AC-17 relaxed to "within 70 s" | Decision after validation: the 60 s claim expiry plus the 10 s sweep can't meet 60 s; a 10 s difference has no user impact | SRS §6, §15, §18 |

Deviations that needed no document change: Nest's global body parser turned off (ticket 07, completes design §5); the CLI keeps plain stdout because `demo.sh` parses it (ticket 10); Prisma `createMany({skipDuplicates})` instead of hand-written `ON CONFLICT` (ticket 03).

**SRS inconsistency found by this review (resolved after validation in SRS v1.7: NFR-04 relaxed to "within 70 s"):** NFR-04 says a killed worker's Report "returns to `pending` within 60 s". §8 says it returns once the "claim [is] older than 60 s". The code follows §8, so the worst case is about 70 s (60 s plus the 10 s sweep). Decided: relax NFR-04 rather than expire claims earlier.

## 5. What remains

- **Partly met at validation (§2):** FR-08, FR-24, FR-29, FR-30, FR-34, NFR-06 (CI only), NFR-10, NFR-12/AC-39 (CI run), AC-26 (flaky test), AC-31.
- **Fixed after validation:** AC-26 (ticket 18, D-09); FR-29, FR-30 (ticket 19, D-01, D-02); FR-08, FR-24, NFR-06 (ticket 20, D-03 … D-06, D-08); NFR-04 wording (SRS v1.7).
- **Still partly met:** NFR-10 (D-07, ticket 21 not done), FR-34 / AC-31 and AC-39 (need a GitHub run).
- **Evidence only a real GitHub remote can give:** AC-31 and A4 (push, then "Re-run failed jobs"), AC-39 in CI, and A8 on GitHub runners.
- **Assumptions that need real teams:** A1, A3, A6, A7, A9.

## 6. Next iteration, in value order

1. **Feedback inside CI** (problem definition non-goal 5, marked "#1 priority"): the submission response or a PR comment says "known flaky". It puts the verdict where the Engineer already is.
2. **Close the ⚠️ items in the dashboard:** Collision warning text on the Reports page (also unblocks A9); per-Commit counts on Test detail; clear `error` on success.
3. **Run on a real GitHub remote** and record AC-31, A4, A8 and AC-39. This is cheap and turns four "unknown" or ⚠️ items into evidence.
4. **Stabilise `reports.spec.ts`**: assert `pending` or `processed`. A flaky test in a flaky-test tracker is the best possible dogfood candidate.
5. **NFR-10 state-change logging** completed.
6. An explicit "fixed" state for a Flaky Test (problem definition open questions).
7. Retention for raw content (non-goal 10) once database size matters.

## 7. Technical debt

From the ticket 17 code review (Spec and Standards axes run as separate sub-agents over `945cc04..0f93e66`), plus earlier tickets' follow-ups. Nothing here was fixed in ticket 17, by scope.

| ID | Debt | Where | Axis |
|---|---|---|---|
| D-01 | ~~Test detail doesn't render per-Commit passed/failed/skipped counts (FR-25/FR-29)~~ **Fixed by ticket 19** | `apps/web/src/features/test-detail/TestDetailPage.tsx` | Spec |
| D-02 | ~~Reports page: the Collision warning shows only "Yes". `complete()` never clears an earlier attempt's `error`.~~ **Fixed by ticket 19** | `apps/web/src/features/reports/ReportsPage.tsx`, `apps/api/src/report-processing/report-queue.ts` | Spec |
| D-03 | ~~Search doesn't escape `%`/`_` before `ILIKE`~~ **Fixed by ticket 20** | `apps/api/src/flake-analysis/flake-analysis.service.ts` | Spec |
| D-04 | ~~`runAttempt` is unbounded, so an overflow gives `500`~~ **Fixed by ticket 20** | `packages/contracts/src/reports.ts` | Spec |
| D-05 | ~~The dogfood token isn't masked (`::add-mask::`) before it becomes a step output~~ **Fixed by ticket 20** | `scripts/dogfood.sh`, `.github/workflows/ci.yml` | Spec (NFR-06) |
| D-06 | ~~A failed Report stores raw exception text, including server file paths from Prisma~~ **Fixed by ticket 20** | `apps/api/src/report-processing/report-processing.service.ts` | Spec (§9.1 spirit) |
| D-07 | NFR-10 state-change lines are incomplete or mislabelled | `report-processing.service.ts`, `report-queue.ts`, `cli.ts` | Spec |
| D-08 | ~~`urlencode` in the composite action isn't UTF-8-safe~~ **Fixed by ticket 20** | `.github/actions/submit-report/submit.sh` | Spec |
| D-09 | ~~The AC-26 E2E test races the worker (seen in tickets 04, 06 and 11, and again here)~~ **Fixed by ticket 18**: asserts the terminal `processed` state via `toPass` instead of transient `pending`. | `apps/web/e2e/reports.spec.ts` | Test |
| D-10 | The worker loop doesn't catch errors from the database during claim/`fail`, so the process exits (Compose restarts it) | `apps/api/src/worker.ts` | Spec (minor) |
| D-11 | The ReportQueue seam leaks `Prisma.TransactionClient` and an extra `attempts` parameter beyond design §4's interface, and lives inside `report-processing/` rather than as its own module | `report-queue.ts`, `cli.ts` | Standards |
| D-12 | Time isn't injected everywhere: `new Date()` in `ProjectsService` and the read controllers | `projects.service.ts`, `read-api/*.controller.ts` | Standards |
| D-13 | Duplication: `isUniqueConstraintViolation` ×2, `requireProject` ×3, the Flake `HAVING` predicate ×3, the "3 attempts" and "60 s" literals repeated | various | Standards (smell) |
| D-14 | Test names without an ID: two FR-20 tests and the four per-page AC-37 tests (the ID is only on their `describe`) | `report-processing.int.test.ts`, `accessibility.spec.ts` | Standards |
| D-15 | `npm audit` reports 4 high findings, transitive in the `prisma` CLI. The only offered fix downgrades below ADR-0008's version. | `package-lock.json` | Ticket 01 |
| D-16 | SRS §9.1 has no code for `403`/`405`/`429`. The filter maps them to `500`. | `apps/api/src/platform/` | Ticket 01 |

Small smells noted and accepted: nested ternaries in `FlakyTestsPage.tsx`, the `result` field name (CONTEXT.md lists "result" under Outcome's *Avoid*, but the DB column and the SRS use it), and pass-through row mappers in the read controllers.

## 8. Risks towards production

| Risk | Likelihood / impact | Mitigation today | Next step |
|---|---|---|---|
| Failure messages contain secrets or personal data, stored unredacted (SRS §10) | Medium / high | Internal-network boundary; 8 KB truncation | Redaction rules; retention |
| Dashboard without login (A6) | Depends on the network / high | ADR-0002 precondition; only the submission route public | OIDC if A6 is refuted |
| Public submission route without rate limiting | Low / medium | Per-Project, rotatable tokens | WAF rate limit (design §10 sketch) |
| Unbounded growth of raw content in `bytea` | Certain / medium over time | Small volume (SRS §11) | Retention; move to S3 (ADR-0012) |
| One worker and one database, no backups | Certain / medium | Submissions survive worker loss (NFR-05) | RDS backups; a second worker is safe with `SKIP LOCKED` |
| False verdicts from environment differences (A3) or a changing SHA on re-run (A4) | Unknown / high for trust | `job` and `runAttempt` stored as evidence | Measure A3/A4 on real data |
| Transitive `prisma` CLI vulnerabilities (D-15) | Low (dev/migrate only) / medium | Not in the runtime request path | Upgrade when 7.10.x is patched |
| Performance numbers come from one laptop run each | Medium / low | Large headroom (≥ 4×) | Re-run `perf:*` on target hardware |

## 9. Test summary

Run on 2026-10-14 at `0f93e66` (Apple M1, Node 22.23, Docker 27.4):

| Suite | Command | Result |
|---|---|---|
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Typecheck | `npm run typecheck` | 0 errors (contracts, api, web) |
| Unit | `npm run test:unit` | **40 passed** (contracts 9, api 24, web 7). JUnit module coverage 100% lines, 90.5% branches |
| Integration | `npm run test:integration` | **68 passed** (7 files, Testcontainers PostgreSQL), plus AC-30 action test ok |
| E2E | `npm run test:e2e` × 3 after `npm run demo` | 12 tests. Run 1: 11 passed, 1 failed (`reports.spec.ts`, D-09). Runs 2 and 3: 12 passed. |
| Demo | `docker compose up -d --build && npm run demo` | 28 s; 3 flaky fixtures listed, the always-failing one not |
| Performance | `npm run perf:load`, `perf:processing`, `perf:reads` | Ticket 12 numbers (§2.2), not re-run for this report |
| Playwright demo | `npm run demo:playwright` | Ticket 16, by hand; not re-run |

## 10. Traceability walk-through

Three requirements followed from problem to test, to check the links:

| Requirement | Problem → SRS | Design / ADR | Ticket → commit | Test |
|---|---|---|---|---|
| Flake rule (FR-21) | [Value](01-problem-definition.md#value) → [FR-21, AC-19…21](02-srs.md#54-analysis) | [ADR-0004](adr/0004-flakiness-means-mixed-outcomes-on-the-same-commit.md), design §6 | [04](../.scratch/iteration-1/issues/04-flaky-tests-list.md) → `c2da33b` | `apps/api/test/flake-analysis.int.test.ts` |
| Collisions (FR-17) | [Scope / Analysis](01-problem-definition.md#scope-iteration-1) → [FR-17, AC-14](02-srs.md#53-processing) | [ADR-0005](adr/0005-test-identity-is-classname-and-name-with-collision-detection.md), design §4 (JUnit) | [08](../.scratch/iteration-1/issues/08-collision-detection.md) → `f61377d` | `apps/api/src/junit/junit.test.ts`, `apps/api/test/report-processing.int.test.ts` |
| Reviewer demo (NFR-13) | [Success criterion 4](01-problem-definition.md#success-criteria) → [NFR-13, AC-28](02-srs.md#6-non-functional-requirements) | design §10 | [06](../.scratch/iteration-1/issues/06-reviewer-demo.md) → `e82578d` | `apps/web/e2e/reviewer-demo.spec.ts` |
