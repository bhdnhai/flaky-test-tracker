# 04 — Flaky Tests list

Status: ready-for-agent
Priority: must
Blocked by: 03

## Goal

A Tech Lead opens a Project and sees its Flaky Tests ranked by the number of Flakes in the ranking window.

## Requirements covered

FR-21, FR-22, FR-23, FR-27. ACs: AC-19, AC-20 (list part; the "No Flakes recorded" part is in 05), AC-21, AC-22, AC-26 (Flaky Tests page part).

## Scope

### In

- **FlakeAnalysis** `flakyTests(projectId, windowDays, now)`: one SQL aggregate per design §6 (group by Test and Commit, both passed and failed, Flake time = max `received_at`, count within the window), ordered per FR-23.
- Ranking window from env (`RANKING_WINDOW_DAYS`, default 14, validated 1–90).
- `GET /api/v1/projects/{id}/flaky-tests` with `windowDays` in the response.
- Dashboard Flaky Tests page (FR-27): rows link to Test detail (the page itself comes in 05; link target may 404 until then), empty state; the Projects page now links here.

### Not in this ticket

- Test search and Test detail (05).
- Materialised summary tables (only if 12 proves them necessary).

## Acceptance checks

- [ ] **AC-19** (FR-21). **Given** Test X passed in Report R1 and failed in Report R2, both for Commit C, **then** X has one Flake (on C) and appears on the Flaky Tests list.
- [ ] **AC-20** (FR-21). **Given** Test Y failed in every Report on Commits C1 and C2, and Test Z passed on C1 and failed on C2 (never both on the same Commit), **then** neither Y nor Z appears on the Flaky Tests list, and both show "No Flakes recorded".
- [ ] **AC-21** (FR-21). **Given** Test S was skipped in R1 and failed in R2 on the same Commit, **then** S has no Flake.
- [ ] **AC-22** (FR-22, FR-23). **Given** Test A has 3 Flakes in the last 14 days, Test B has 1 Flake 2 days ago, Test C has 1 Flake 5 days ago, and Test D has 1 Flake 20 days ago, **when** the list is requested with the default window, **then** the order is A, B, C, and D is not listed. **Given** the window is configured to 30 days, **then** D is also listed, last.
- [ ] **AC-26** (FR-26, FR-27, FR-30). **Given** Projects `web-app` and `api`, **when** the Projects page is opened, **then** both are listed by name. Opening `web-app` shows its Flaky Tests page, and from there its Reports page lists its Reports newest first with their processing states.

**How to verify by hand:**

- Submit the same Vitest Report twice for one Commit, but edit one test case from passing to failing in the second copy: that Test appears on the Flaky Tests page with 1 Flake.
- Set `RANKING_WINDOW_DAYS=1` and restart `api`: an older Flake disappears from the list.

## Tests expected

- **Integration:** seeded Outcomes with a test clock (`now` passed in) for AC-19 to AC-22, including the ordering tie-breaks and the 30-day window.
- **E2E:** the Flaky Tests page lists a Flaky Test after two submissions (AC-26 part).

## Design notes

- Modules: **FlakeAnalysis** (owns the aggregation SQL; typed raw query validated with Zod), **ReadApi**, dashboard feature `flaky-tests`.
- ADRs: 0004 (definition of a Flake), 0008 (raw SQL for hot queries).
- Design §6 (computed on read; fallback noted).

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
