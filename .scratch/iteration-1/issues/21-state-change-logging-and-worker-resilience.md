# 21 — Complete state-change logging and worker resilience

Status: ready-for-agent
Priority: stretch
Blocked by: 17

## Goal

Every Report state change produces exactly one correctly labelled log line, and a database error in the worker loop is logged and retried instead of killing the process.

## Requirements covered

NFR-10 (state-change lines), NFR-04/NFR-05 (worker keeps running). Defects D-07, D-10.

## Scope

### In

- **D-07:** one log line per transition, with `reportId`, `from`, `to`, `attempt`, `durationMs` where applicable:
  - claim `pending→processing`;
  - retry `processing→pending` and final `processing→failed` (replace the `processing-failed` label);
  - each expired claim individually (not just a count);
  - `reprocess-report` `processed|failed→pending`.
- **D-10:** the worker loop catches errors from `claimNext`, `fail` and `sweep`, logs them, backs off briefly and continues.

### Not in this ticket

- Metrics or tracing (design §9).
- The ReportQueue interface cleanup (D-11, recorded as debt).

## Acceptance checks

- [ ] Given one Report that fails once and then succeeds, then the logs contain, in order: `pending→processing`, `processing→pending`, `pending→processing`, `processing→processed`, all with the same `reportId` (extends **AC-38**).
- [ ] Given an expired claim, then one line `processing→pending` (or `→failed`) for that `reportId`.
- [ ] Given `reprocess-report <id>`, then one line `processed→pending` for that id.
- [ ] Given the database is briefly unreachable while the worker runs, then the worker logs the error and keeps running; after the database returns, `pending` Reports are processed (extends **AC-18**).

**How to verify by hand:**

- `docker compose logs worker | grep <reportId>` after a demo run shows the full transition sequence.
- `docker compose stop db; sleep 5; docker compose start db` → `worker` container is still up (`docker compose ps`) and continues processing.

## Tests expected

- **Integration:** capture logger output through the processing seam with the test clock for the transition sequences; a loop test with an injected failing queue call for D-10.

## Design notes

- **ReportProcessing**, **ReportQueue**, worker entry point, CLI. Design §9 (log line fields).

## Definition of done

- [ ] Each acceptance check above has a passing test, with the AC ID (or defect ID) in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests green; E2E green if the dashboard or demo is touched.
- [ ] `docs/04-validation.md`: the rows for the requirements and defects listed under "Requirements covered" updated to their new status (✅ where fixed), with evidence; each fixed defect ID marked fixed in the debt table (§7) with this ticket number. Keep the original finding text visible.
- [ ] `docs/02-srs.md` traceability matrix updated if test files changed; an SRS history row only if a requirement changed.
- [ ] README updated if commands changed.
- [ ] One focused commit, Conventional Commits, referencing this ticket.

## Comments

