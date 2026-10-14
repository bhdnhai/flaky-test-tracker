# 16 — Playwright demo fixtures

Status: resolved
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

- [x] **AC-33** (FR-35). **Given** browsers are installed, **when** `npm run demo:playwright` runs, **then** the Playwright flaky fixtures appear on the `demo` Project's Flaky Tests list.

**How to verify by hand:**

- `npm run demo:playwright`: the Playwright flaky fixtures appear on the `demo` Project's Flaky Tests list, one Test per browser project.

## Tests expected

- **E2E:** AC-33 after running the script.

## Design notes

- ADR-0005 (reporter option). Prototype findings (Playwright fixtures and their measured rates).

## Definition of done

- [x] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [x] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [x] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [x] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [x] README updated if setup, run or test commands changed.
- [x] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

Built: `fixtures/playwright-flaky-suite` (Playwright fixture reusing `fixtures/flaky-suite`'s
exact completion-order race, `chromium`/`firefox` projects, `includeProjectInTestName: true` per
ADR-0005); `demo-playwright` Compose service (profile `demo-playwright`) built from the official
Playwright image (`mcr.microsoft.com/playwright:v1.64.0-noble`), so the fixtures themselves need
no host browser install; `scripts/demo-playwright.sh` (adds to the same `demo` Project as
`npm run demo`, 10 runs, submit, poll, then runs the AC-33 check); `apps/web/e2e-demo-playwright/
reviewer-demo-playwright.spec.ts` + its own `playwright.demo-playwright.config.ts`, kept out of
the default `test:e2e` testDir so it doesn't join CI's `e2e` job (which only runs plain
`npm run demo`). Verified by hand: `docker compose up -d --build`, `npm run demo`, then
`npm run demo:playwright` — populated the `demo` Project with one Flaky Test per browser project
and the AC-33 spec passed against the live dashboard. No divergence from the SRS/design; no new
CONTEXT.md term or ADR needed (ADR-0005 already anticipated this fixture's reporter option).
