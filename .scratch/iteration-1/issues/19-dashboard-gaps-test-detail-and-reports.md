# 19 — Dashboard gaps: per-Commit counts on Test detail; Collision text and stale errors on the Reports page

Status: ready-for-agent
Priority: must
Blocked by: 17

## Goal

Test detail shows how many times a Test passed, failed and was skipped on each Commit, and the Reports page shows a Report's Collisions with the fix and never shows a stale error.

## Requirements covered

FR-29 (with FR-25's per-Commit counts), FR-30 (with FR-17's warning text and UC-3). Defects D-01, D-02.

## Scope

### In

- **Test detail page:** for each Commit row, render the `passed`, `failed` and `skipped` counts the API already returns (FR-25).
- **Reports page:** render the Collision warning as the colliding identities (`classname` + `name`, with count) and the fix text (`includeProjectInTestName: true` for Playwright, `classNameTemplate` containing `{filepath}` for jest-junit), not just "Yes". Keep it compact (for example an expandable row or a tooltip that is keyboard-accessible).
- **ReportQueue `complete()`:** clear `error` when a Report reaches `processed`, so a Report that failed one attempt and then succeeded shows no error.

### Not in this ticket

- Any API shape change (the data is already returned).
- Other dashboard redesign.

## Acceptance checks

- [ ] Given a Test with Outcomes on Commit C (2 passed, 1 failed, 1 skipped), when its detail is opened, then C's row shows 2 / 1 / 1. (FR-29, D-01)
- [ ] **AC-14**'s Report, when shown on the Reports page, shows the colliding identity and the text `includeProjectInTestName`. (FR-30, D-02)
- [ ] Given a Report whose first processing attempt failed and whose second succeeded, then the API returns `error: null` for it and the Reports page shows no error. (FR-30, D-02)
- [ ] **AC-37** still holds on both pages (axe: 0 serious/critical; keyboard access to the warning).

**How to verify by hand:**

- Submit the prototype's Playwright two-project sample (no `includeProjectInTestName`): the Reports page shows the identity and the fix.
- Open any Test detail after `npm run demo`: each Commit row shows its counts.

## Tests expected

- **Integration:** `complete()` clears `error` after a failed attempt (through the processing seam with the test clock).
- **E2E:** extend the Test detail and Reports specs for the counts and the Collision text; re-run the accessibility spec.

## Design notes

- Dashboard features `test-detail`, `reports`; **ReportQueue** (`complete`). ADR-0005 (fix text), ADR-0011.
- Report-derived text stays text-only (NFR-08).

## Definition of done

- [ ] Each acceptance check above has a passing test, with the AC ID (or defect ID) in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests green; E2E green if the dashboard or demo is touched.
- [ ] `docs/04-validation.md`: the rows for the requirements and defects listed under "Requirements covered" updated to their new status (✅ where fixed), with evidence; each fixed defect ID marked fixed in the debt table (§7) with this ticket number. Keep the original finding text visible.
- [ ] `docs/02-srs.md` traceability matrix updated if test files changed; an SRS history row only if a requirement changed.
- [ ] README updated if commands changed.
- [ ] One focused commit, Conventional Commits, referencing this ticket.

## Comments

