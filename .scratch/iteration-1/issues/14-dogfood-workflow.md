# 14 — Dogfood workflow: this repository submits its own Reports

Status: resolved
Priority: stretch
Blocked by: 13

## Goal

This repository's GitHub Actions workflow submits Reports to the tracker running inside the job, and a re-run proves same-Commit evidence on real GitHub infrastructure.

## Requirements covered

FR-34 (Should); assumption A4. ACs: AC-31.

## Scope

### In

- `dogfood` job in `ci.yml`: compose up, create a Project via the CLI, run the fixture suite once, submit with the composite action, then query the API to assert the Report was processed with `runAttempt` = `GITHUB_RUN_ATTEMPT`.
- Record a re-run's evidence (run links, both attempts' Commit and attempt) in the ticket comments for the validation report, and update A4's status.

### Not in this ticket

- A long-lived hosted instance.

## Acceptance checks

- [ ] **AC-31** (FR-34, A4). **Given** this repository's workflow, **when** a run is re-run with "Re-run failed jobs", **then** both attempts submit Reports with the same `commit` and different `runAttempt` values.

**How to verify by hand:**

- Push, let CI run, click "Re-run failed jobs" (or "Re-run all jobs"): both attempts submit with the same `commit` and different `runAttempt`.

## Tests expected

- **CI integration:** the job's own assertions (AC-31).

## Design notes

- Design §11 (dogfood job). ADR-0002 addendum.

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

Added the `dogfood` job (needs `e2e`) and `scripts/dogfood.sh`: creates a Project, runs the
fixture suite once, submits via `uses: ./.github/actions/submit-report`, then asserts the
Report's `commitSha`/`runAttempt` against `GITHUB_SHA`/`GITHUB_RUN_ATTEMPT`. Verified locally
against the Compose stack by submitting two distinct fixture-suite outputs for the same commit
as attempts 1 and 2 (resubmitting identical bytes instead hits FR-12's dedupe, as expected).

Follow-up (needs a real push + "Re-run failed jobs" on GitHub — no remote is configured in this
sandbox): record both attempts' run links, `commit` and `runAttempt` here, and flip A4 from
Open to Confirmed in `docs/01-problem-definition.md`.
