# 15 — Reprocess a Report from the CLI

Status: resolved
Priority: stretch
Blocked by: 09

## Goal

An Operator can send a `processed` or `failed` Report back for processing, for example after fixing a parser bug.

## Requirements covered

FR-20 (Could). ACs: AC-32.

## Scope

### In

- `reprocess-report <reportId>` → `ReportQueue.requeue(id)`: `processed`/`failed` → `pending`, attempts reset; idempotency (FR-18) guarantees no duplicate Outcomes.

### Not in this ticket

- Bulk reprocessing; a UI button.

## Acceptance checks

- [ ] **AC-32** (FR-20). **Given** a `failed` Report, **when** the Operator runs `reprocess-report <id>`, **then** it returns to `pending` and is processed again.

**How to verify by hand:**

- Take a `failed` Report ID from the Reports page; `docker compose exec api node dist/cli.js reprocess-report <id>` → it shows `pending`, then is processed again.

## Tests expected

- **Integration:** AC-32 through the CLI context; Outcome count unchanged for an already `processed` Report.

## Design notes

- Modules: CLI entry point, **ReportQueue**. SRS §8 (reprocess transitions).

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

Built `reprocess-report <reportId>` → `ReportQueueService.requeue()`: processed/failed → pending, attempts/claim/error reset; other states rejected with `ReportNotReprocessableError` (SRS §8 transition table), unknown ID with `ReportNotFoundError`. Idempotent re-processing was already guaranteed by `Outcome.createMany({ skipDuplicates: true })` from ticket 09 — no changes needed there. No SRS/design deviations. Integration tests only (no unit seam in scope).
