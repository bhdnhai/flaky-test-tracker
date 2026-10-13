# 11 — Dashboard hardening and full core-workflow E2E

Status: resolved
Priority: must
Blocked by: 05, 06

## Goal

The dashboard is safe against Report-derived content, usable by keyboard and screen reader, and the whole core workflow is proven end to end in a browser.

## Requirements covered

NFR-08, NFR-09, NFR-14. ACs: AC-27, AC-37, plus E2E coverage for AC-23, AC-25, AC-26.

## Scope

### In

- Lint rule banning `dangerouslySetInnerHTML`; review all pages for text-only rendering of Report data.
- axe-core checks on the Projects, Flaky Tests, Test detail and Reports pages; fix serious or critical violations (labels, headings, focus order, contrast).
- Keyboard-only path for the core workflow (search → result → detail).
- A single Playwright spec of the full core workflow on the demo data: Projects → Flaky Tests → search → Test detail verdict → Reports.

### Not in this ticket

- Visual redesign; mobile-specific layouts (SRS §14).

## Acceptance checks

- [x] **AC-27** (NFR-08). **Given** a Test named `<img src=x onerror=alert(1)>`, **when** it appears on any page, **then** it is shown as literal text and no script runs.
- [x] **AC-37** (NFR-09). axe-core run by Playwright on the Projects, Flaky Tests, Test detail and Reports pages reports 0 serious or critical violations. The core workflow of AC-23 can be completed with the keyboard only.
- [x] **AC-23** (FR-24, FR-28, NFR-14). **Given** Tests `report ingestion > parses` (no Flakes) and `checkout > pays` (2 Flakes), **when** the Engineer types `INGEST` into the search on the Flaky Tests page, **then** the first Test is shown; one click opens its detail, which shows "No Flakes recorded".
- [x] **AC-25** (FR-25, FR-29). **Given** Test X has Outcomes on 60 Commits, 2 of them Flakes, one 3 days ago and one 30 days ago, **when** its detail is opened, **then** the verdict is the first element on the page and says Flaky with 2 Flakes in total and 1 in the 14-day window, the history shows 50 Commits newest first, and each Flake Commit lists its passed and failed Outcomes with failure messages and Report metadata.
- [x] **AC-26** (FR-26, FR-27, FR-30). **Given** Projects `web-app` and `api`, **when** the Projects page is opened, **then** both are listed by name. Opening `web-app` shows its Flaky Tests page, and from there its Reports page lists its Reports newest first with their processing states.

**How to verify by hand:**

- Submit a Report with a test named `<img src=x onerror=alert(1)>`: it shows as literal text everywhere.
- Unplug the mouse: complete search → detail with Tab and Enter only.

## Tests expected

- **E2E:** AC-27 (no dialog fires, the text is visible), AC-37 (axe on 4 pages + keyboard flow), the full core workflow covering AC-23, AC-25 and AC-26 in one browser run.
- **Unit/Integration:** none new.

## Design notes

- Dashboard features `projects`, `flaky-tests`, `test-detail`, `reports`. Design §4 frontend rules, §7 output encoding.

## Definition of done

- [x] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [x] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo. (E2E green except a pre-existing, unrelated flake — see Comments.)
- [x] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [x] N/A — implementation didn't prove the SRS/design wrong; it brought the code in line with what design §4 already specified (verdict first) and fixed real bugs the ticket's hardening pass surfaced.
- [x] N/A — no setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

Built: `no-restricted-syntax` ESLint rule banning `dangerouslySetInnerHTML`; `xss-safety.spec.ts` (AC-27); `accessibility.spec.ts` (axe-core on all 4 pages + keyboard-only path, AC-37); `core-workflow.spec.ts` (AC-23, AC-25, AC-26 in one browser run).

Deviations: moved `TestDetailPage`'s verdict above the heading (AC-25 required it first) and fixed a real axe "serious" violation on `ProjectsPage` (`<ul>` had `<a>` children, not `<li>`, from a bare `ListItemButton`); also gave the per-Commit subtitle `component="h2"` to fix heading-order under the new verdict-first layout.

Follow-up (out of scope, pre-existing): `apps/web/e2e/reports.spec.ts`'s first test races the worker and fails intermittently (~1/3 runs) when the stack is fast/unloaded — the Report reaches `processed` before the UI checks for `pending`. Not touched here; unrelated to this ticket's files.
