# 16 — Playwright demo fixtures

Status: ready-for-agent
Priority: stretch
Blocked by: 06

## Goal

The demo can also show flakiness from a Playwright suite, the UI-timing pattern the target teams know best.

## Requirements covered

FR-35 (Could). ACs: AC-33.

## Scope

### In

- Playwright fixtures reusing the completion-order race, with `includeProjectInTestName: true` if more than one browser project is configured.
- `npm run demo:playwright` (documented as needing browser installs, or run in the official Playwright image).

### Not in this ticket

- Making Playwright part of the default `npm run demo` (keeps the 5-minute target safe).

## Acceptance checks

- [ ] **AC-33** (FR-35). **Given** browsers are installed, **when** `npm run demo:playwright` runs, **then** the Playwright flaky fixtures appear on the `demo` Project's Flaky Tests list.

**How to verify by hand:**

- `npm run demo:playwright`: the Playwright flaky fixtures appear on the `demo` Project's Flaky Tests list, one Test per browser project.

## Tests expected

- **E2E:** AC-33 after running the script.

## Design notes

- ADR-0005 (reporter option). Prototype findings (Playwright fixtures and their measured rates).

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
