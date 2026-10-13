# 09 — Processing reliability: retries, failure, claim expiry, idempotency

Status: ready-for-agent
Priority: must
Blocked by: 03

## Goal

No accepted Report is ever lost or double-counted: failed processing is retried and then marked `failed` with its error, a killed worker's claim expires, and submissions keep working while the worker is down.

## Requirements covered

FR-18, FR-19; NFR-04, NFR-05. ACs: AC-13, AC-16, AC-17, AC-18.

## Scope

### In

- **ReportQueue** `fail(id, error, now)`: `pending` with `next_attempt_at = now + 2^attempts s` while attempts < 3, else `failed` with the error (≤ 1 KB). `releaseExpired(now)`: claims older than 60 s go back to `pending`, or `failed` when attempts = 3 (SRS v1.1 §8).
- **ReportProcessing** `sweep(now)` on a timer in the worker.
- Injected `Clock` (system and test adapters).
- The Reports page shows `failed` with the error.

### Not in this ticket

- `reprocess-report` CLI (15).

## Acceptance checks

- [ ] **AC-13** (FR-19, NFR-05). **Given** a well-formed Report with root `<testsuites>` but test cases the parser can't read, **when** it is submitted, **then** the response is still `202`, and after 3 attempts the Report is `failed`, with an error shown on the Reports page.
- [ ] **AC-16** (FR-18, NFR-04). **Given** a processed Report, **when** it is processed again (by reprocessing or a simulated retry), **then** the number of Outcomes for that Report doesn't change.
- [ ] **AC-17** (NFR-04). **Given** a Report in `processing` whose worker was killed, **when** 60 s have passed and the worker is running again, **then** the Report reaches `processed` and has exactly one Outcome per test case.
- [ ] **AC-18** (NFR-05). **Given** the worker is stopped, **when** 3 Reports are submitted, **then** all get `202` and stay `pending`. **When** the worker starts, **then** all 3 reach `processed`.

**How to verify by hand:**

- `docker compose stop worker`; submit 3 Reports → all `202`, shown as `pending`; `docker compose start worker` → all `processed` (AC-18).
- Submit `<testsuites><bogus/></testsuites>`-style content the parser can't read → `202`, then `failed` with an error on the Reports page after 3 attempts.

## Tests expected

- **Integration:** with a test clock: retry schedule and final `failed` (AC-13); reprocess twice → same Outcome count (AC-16); a claim with no completion expires after 60 s and is then processed exactly once (AC-17); a poison Report fails after 3 expiries; worker stopped → submissions accepted, processed after restart (AC-18).
- **E2E:** none.

## Design notes

- Modules: **ReportQueue** (seam; all lifecycle rules live here), **ReportProcessing**.
- ADRs: 0003, 0011. Design §4 (time passed in), §6 (failure statement). SRS §8 transition table is the specification.

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
