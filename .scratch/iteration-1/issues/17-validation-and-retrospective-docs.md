# 17 — Validation and retrospective docs

Status: resolved
Priority: must
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13 (and 14, 15, 16 if done)

## Goal

The assignment's step 5 deliverables exist and are honest: what was built, what is covered, what changed, what remains, the risks, and how AI was used.

## Requirements covered

All FRs, NFRs and ACs (coverage audit). Assignment deliverables: validation, retrospective, AI usage.

## Scope

### In

- Code review of iteration 1 against the SRS (both axes: Spec, Standards).
- `docs/04-validation.md`: implemented slice and demo path; a coverage table for every FR/NFR/AC (✅ / ⚠️ / ❌ / ⏭ deferred by decision) with evidence; changes vs the SRS and design with triggers and links; assumptions confirmed/refuted/unknown; what remains; next iteration in value order; technical debt; risks toward production; test summary.
- SRS traceability matrix brought in sync.
- `docs/05-retrospective.md` (about one page).
- `docs/06-ai-usage.md` (short, factual).
- README final pass: links to all docs in reading order.

### Not in this ticket

- New features. Fixes found during review become new tickets or are listed as debt.

## Acceptance checks

- [x] Every FR, NFR and AC ID in `docs/02-srs.md` appears in the validation coverage table with a status and evidence.
- [x] Every assumption A1–A10 has a status with evidence.
- [x] The retrospective and the AI usage summary exist and are linked from the README.

**How to verify by hand:**

- A reviewer can follow Problem → SRS → Design → Tickets → Commits → Tests → Validation for any 3 requirements without a broken link.

## Tests expected

- None (documentation). Every claimed ✅ must point to a test or file that exists.

## Design notes

- Inputs: all ticket `## Comments`, the SRS document history, the design, ADRs, `git log`.

## Definition of done

- [x] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [x] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [x] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [x] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [x] README updated if setup, run or test commands changed.
- [x] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

### 2026-10-14: resolved

**Built:** `docs/04-validation.md` (coverage of all 35 FRs, 14 NFRs, 39 ACs and A1–A10, each with a status and evidence; changes vs SRS/design; debt D-01…D-16; risks; test summary; traceability walk-through for FR-21, FR-17, NFR-13), `docs/05-retrospective.md`, `docs/06-ai-usage.md`; SRS v1.6 (matrix synced, §13 statuses); design header → SRS v1.6; README docs list in reading order. Every evidence path was checked by script to exist.

**Two-axis code review of `945cc04..0f93e66`** (Spec and Standards, parallel sub-agents). Findings were verified by reading the code, then recorded as debt, not fixed (scope). The most important:
- FR-29: Test detail doesn't render per-Commit counts. FR-30: the Collision warning shows only "Yes", and a stale `error` stays on a Report that later succeeds. These are Must dashboard gaps that AC tests didn't catch, because no AC checks them.
- NFR-10: state-change logging is incomplete (no claim line; `to: "processing-failed"`).
- FR-24: `%`/`_` aren't escaped in search. FR-08: `runAttempt` overflow gives `500`. The dogfood token isn't masked in CI logs (NFR-06).

**Discovery (SRS wrong):** NFR-04 ("within 60 s") contradicts §8 ("claim older than 60 s"). The code follows §8, so the worst case is about 70 s. Recorded in SRS v1.6 history and validation §4.1, not resolved.

**Verification run:** lint and typecheck 0 errors; 40 unit, 68 integration tests and the AC-30 action test passed; demo 28 s; E2E 12 tests, with `reports.spec.ts` failing 1 of 3 runs (known race, D-09).

**Follow-ups (candidates for new tickets):** D-01/D-02 dashboard gaps; D-09 flaky E2E; D-07 logging; D-03/D-04/D-05/D-08 small fixes; push to a GitHub remote to capture AC-31, A4, A8 and AC-39 evidence; decide NFR-04 vs §8.
