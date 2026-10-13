# 05 — Test search and Test detail with verdict

Status: ready-for-agent
Priority: must
Blocked by: 04

## Goal

An Engineer types a failing Test's name, opens its detail, and reads the verdict ("Flaky: N Flakes" or "No Flakes recorded") with its evidence by Commit.

## Requirements covered

FR-24, FR-25, FR-28, FR-29; NFR-14. ACs: AC-23, AC-24, AC-25, AC-20 (verdict part).

## Scope

### In

- **FlakeAnalysis** `search(projectId, query)` (case-insensitive substring over `name` and `classname`, 2–200 chars, sorted, max 50, includes Tests with no Flakes, `totalFlakes` per result) and `testDetail(projectId, testId, windowDays, now)` (verdict + last 50 Commits newest first with counts, `isFlake`, Outcomes with failure messages and Report metadata).
- `GET /api/v1/projects/{id}/tests?search=` and `GET /api/v1/projects/{id}/tests/{testId}`; a Test from another Project → 404.
- Dashboard: search field on the Flaky Tests page (FR-28) and the Test detail page with the verdict as the first element (FR-29).

### Not in this ticket

- Paging beyond the caps (SRS §14).
- Accessibility audit and XSS E2E (11). The page must still use plain text rendering.

## Acceptance checks

- [ ] **AC-20** (FR-21). **Given** Test Y failed in every Report on Commits C1 and C2, and Test Z passed on C1 and failed on C2 (never both on the same Commit), **then** neither Y nor Z appears on the Flaky Tests list, and both show "No Flakes recorded". *(Verdict part: both Tests' detail says "No Flakes recorded".)*
- [ ] **AC-23** (FR-24, FR-28, NFR-14). **Given** Tests `report ingestion > parses` (no Flakes) and `checkout > pays` (2 Flakes), **when** the Engineer types `INGEST` into the search on the Flaky Tests page, **then** the first Test is shown; one click opens its detail, which shows "No Flakes recorded".
- [ ] **AC-24** (FR-24). **Given** a search query of 1 character or 201 characters, **then** the response is `400 VALIDATION_ERROR`.
- [ ] **AC-25** (FR-25, FR-29). **Given** Test X has Outcomes on 60 Commits, 2 of them Flakes, one 3 days ago and one 30 days ago, **when** its detail is opened, **then** the verdict is the first element on the page and says Flaky with 2 Flakes in total and 1 in the 14-day window, the history shows 50 Commits newest first, and each Flake Commit lists its passed and failed Outcomes with failure messages and Report metadata.

**How to verify by hand:**

- On the Flaky Tests page, type part of a test name that never flaked: one click opens its detail, which says "No Flakes recorded".
- Open a flaky one: the verdict is at the top; its Flake Commits show both the passed and failed Outcomes with the failure message.

## Tests expected

- **Unit:** search query schema boundaries (AC-24).
- **Integration:** search results and ordering; Test detail with 60 Commits (cap 50, newest first), totals vs in-window counts with a test clock (AC-25); cross-Project 404.
- **E2E:** type → click → verdict in ≤ 2 clicks (AC-23).

## Design notes

- Modules: **FlakeAnalysis**, **ReadApi**, dashboard features `flaky-tests` (search) and `test-detail`.
- ADR: 0004. Design §4 frontend table (the verdict comes from the API; no Flake rules in the browser).

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
