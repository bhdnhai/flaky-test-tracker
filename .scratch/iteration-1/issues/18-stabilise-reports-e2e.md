# 18 — Stabilise the flaky Reports page E2E test

Status: ready-for-agent
Priority: must
Blocked by: 17

## Goal

The Reports page E2E test stops racing the worker, so the E2E suite of a flaky-test tracker is itself not flaky.

## Requirements covered

AC-26 (currently ⚠️ because its test is flaky). Defect D-09 in `docs/04-validation.md`.

## Scope

### In

- Make `reports.spec.ts` deterministic. The test asserts `pending` right after submission, but the worker may already have processed the Report. Assert what AC-26 actually requires: the Report is listed newest first with **a** processing state (`pending`, `processing` or `processed`), or wait for the terminal state with Playwright's polling assertions (`expect.poll` / `toHaveText` with a timeout) instead of a fixed expectation.
- Check the other E2E specs for the same pattern (asserting a transient state) and fix any found.

### Not in this ticket

- Changing worker timing or the product's behaviour to suit the test.

## Acceptance checks

- [ ] **AC-26** holds and its test asserts no transient state.
- [ ] Given the Compose stack with `npm run demo` run once, when `npm run test:e2e` runs **10 times in a row**, then all runs pass.

**How to verify by hand:**

- `for i in $(seq 10); do npm run test:e2e || break; done` → no failures.

## Tests expected

- **E2E:** the changed spec(s), run 10× as above. Record the result in Comments.

## Design notes

- Design §8 (tests assert observable behaviour). The fix belongs in the test, not the product.

## Definition of done

- [ ] Each acceptance check above has a passing test, with the AC ID (or defect ID) in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests green; E2E green if the dashboard or demo is touched.
- [ ] `docs/04-validation.md`: the rows for the requirements and defects listed under "Requirements covered" updated to their new status (✅ where fixed), with evidence; each fixed defect ID marked fixed in the debt table (§7) with this ticket number. Keep the original finding text visible.
- [ ] `docs/02-srs.md` traceability matrix updated if test files changed; an SRS history row only if a requirement changed.
- [ ] README updated if commands changed.
- [ ] One focused commit, Conventional Commits, referencing this ticket.

## Comments

