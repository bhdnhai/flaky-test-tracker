# 06 — Reviewer demo: genuinely flaky suite and `npm run demo`

Status: ready-for-agent
Priority: must
Blocked by: 05

## Goal

A reviewer runs `docker compose up -d --build` and `npm run demo`, and within 5 minutes sees the demo Project's Flaky Tests produced by tests that genuinely flaked on their machine.

## Requirements covered

FR-31, FR-32; NFR-13. ACs: AC-28, AC-29.

## Scope

### In

- Fixture suite workspace: at least 3 flaky tests using the completion-order race from the prototype (two jobs with delays from the same distribution, asserting a fixed order), 1 always-failing test, at least 1 always-passing test. Vitest built-in JUnit reporter. No seeds, attempt counters or env vars deciding outcomes.
- `demo` Compose service (profile `demo`) built from the fixture suite with dependencies installed at image build time.
- `scripts/demo.sh`, run by `npm run demo` (root script, no `npm install` needed): `create-project demo`, or `rotate-token demo` if it already exists; run the suite 10 times in the `demo` service; submit each Report to the API over the Compose network with `commit=$(git rev-parse HEAD)` and run metadata; poll each Report until it leaves `pending`/`processing`; print the dashboard URL.
- CI: add the `e2e` job to `ci.yml`: compose up → `npm run demo` → Playwright.
- README quick start updated to the three commands.

### Not in this ticket

- Playwright fixtures (16).
- The composite GitHub Action (13). The demo uses the same HTTP request directly.

## Acceptance checks

- [ ] **AC-28** (FR-31, FR-32, NFR-13, G1, G4). **Given** a fresh clone with Docker and Node, **when** the reviewer runs `docker compose up -d` and `npm run demo`, **then** within 5 minutes (excluding the first image download) the demo prints a dashboard URL, the `demo` Project's Flaky Tests list contains every flaky fixture test, and the always-failing fixture test is **not** listed.
- [ ] **AC-29** (FR-31). **Given** the fixture suite's source, **then** no test reads an attempt counter, a seed or an environment variable to decide its outcome (code review checklist item).

**How to verify by hand:**

- From a fresh clone: `docker compose up -d --build && npm run demo`; open the printed URL. All flaky fixture tests are listed; the always-failing one is not.
- Run `npm run demo` a second time: it reuses the `demo` Project (token rotated) and the counts grow.

## Tests expected

- **E2E:** Playwright after `npm run demo`: every flaky fixture is on the list, the broken one isn't (AC-28). Timed in CI to stay under 5 minutes, excluding the image pull.
- **Review:** AC-29 is a code-review checklist item, recorded in the commit message.

## Design notes

- Design §10 (local deployment and the demo script), §11 (e2e job).
- The fixture technique comes from `.scratch/prototypes/reporter-output-and-flakiness/handoff-back.md` (A8 confirmed at 35–60% on host and `--cpus=0.5`).
- Platform note: `demo.sh` is bash; document WSL for Windows.

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
