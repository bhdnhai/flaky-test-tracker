# 08 — Collision detection and warning

Status: ready-for-agent
Priority: must
Blocked by: 03

## Goal

When a Report contains the same Test identity more than once, those test cases never produce a false Flake, and the Reports page tells the Operator which reporter option fixes it.

## Requirements covered

FR-17. ACs: AC-14, AC-15.

## Scope

### In

- **JUnit** `interpret` returns `collisions`; colliding cases are excluded from its `cases`.
- Processing stores the Collision warning on the Report (identities + fix: `includeProjectInTestName: true` for Playwright, `classNameTemplate` with `{filepath}` for jest-junit) and records no Outcomes for them; the Report is still `processed`.
- The Reports page shows the warning.

### Not in this ticket

- Detecting which reporter produced the file (rejected in ADR-0005).

## Acceptance checks

- [ ] **AC-14** (FR-17). **Given** a Playwright Report with two projects and no `includeProjectInTestName` (identical `classname`/`name` under `hostname="chromium"` and `hostname="firefox"`), where chromium passed and firefox failed, **when** it is processed, **then** the Report is `processed`, its Collision warning lists that identity and mentions `includeProjectInTestName`, and no Outcome (and so no Flake) is recorded for it.
- [ ] **AC-15** (FR-17, FR-14). **Given** the same Playwright suite reported with `includeProjectInTestName: true`, **when** it is processed, **then** there are two distinct Tests, one per project, and no Collision warning.

**How to verify by hand:**

- Submit the prototype's Playwright two-project sample (no `includeProjectInTestName`): the Reports page shows a warning naming the option; the test isn't on the Flaky Tests list even though chromium passed and firefox failed.

## Tests expected

- **Unit:** JUnit module with the prototype's Playwright multi-project and jest-junit default samples (AC-14, AC-15 interpretation).
- **Integration:** end to end through processing: no Outcome for colliding cases; the warning is on the Report (AC-14); with the option, two Tests (AC-15).
- **E2E:** none (the Reports page rendering is covered in 11's page audit).

## Design notes

- Modules: **JUnit**, **ReportProcessing**, dashboard feature `reports`.
- ADR: 0005. SRS §7 note: the `(report_id, test_id)` unique constraint relies on Collisions recording no Outcomes.

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
