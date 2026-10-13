# 17 — Validation and retrospective docs

Status: ready-for-agent
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

- [ ] Every FR, NFR and AC ID in `docs/02-srs.md` appears in the validation coverage table with a status and evidence.
- [ ] Every assumption A1–A10 has a status with evidence.
- [ ] The retrospective and the AI usage summary exist and are linked from the README.

**How to verify by hand:**

- A reviewer can follow Problem → SRS → Design → Tickets → Commits → Tests → Validation for any 3 requirements without a broken link.

## Tests expected

- None (documentation). Every claimed ✅ must point to a test or file that exists.

## Design notes

- Inputs: all ticket `## Comments`, the SRS document history, the design, ADRs, `git log`.

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
