# 20 — Security and validation fixes

Status: ready-for-agent
Priority: must
Blocked by: 17

## Goal

Small input and secret-handling defects from the validation are closed: no token in CI logs, no `500` from bad input, no wildcard search, no server paths in stored errors, and UTF-8-safe metadata from the composite action.

## Requirements covered

FR-08, FR-24, NFR-06, SRS §9.1 (no internals in error text), FR-33. Defects D-03, D-04, D-05, D-06, D-08.

## Scope

### In

- **D-04:** `runAttempt` upper bound (≤ 2³¹−1) in the contracts schema → `400 VALIDATION_ERROR`, not `500`.
- **D-03:** escape `\`, `%` and `_` in the search query before `ILIKE` (with an explicit `ESCAPE`), so the query is a literal "contains".
- **D-05:** mask the dogfood token with `::add-mask::` before it becomes a step output or input.
- **D-06:** a `failed` Report stores a short, user-safe error (for example "could not read test cases: <reason>"), not raw exception text with file paths or Prisma internals. Full details go to the log only. The ≤ 1 KB cap still applies.
- **D-08:** make `urlencode` in the composite action UTF-8-safe (for example via `jq -sRr @uri` or byte-wise encoding).

### Not in this ticket

- Rate limiting, token expiry (SRS §14).
- Worker crash handling (D-10, ticket 21).

## Acceptance checks

- [ ] Given `runAttempt=2147483648`, then `400 VALIDATION_ERROR` (D-04, extends **AC-07**).
- [ ] Given Tests `a_b` and `axb`, when searching `a_b`, then only `a_b` is returned; searching `100%` matches only names containing `100%` (D-03, extends **AC-24**).
- [ ] Given a Report that fails processing because of a database error, then its stored `error` contains no file path and no Prisma class name, and the full error appears in the worker log (D-06, extends **AC-13**).
- [ ] Given branch `feat/ümlaut-тест`, when the composite action submits, then the Report's `branch` equals it exactly (D-08, extends **AC-30**).
- [ ] The dogfood job masks the token before any use (D-05); review `scripts/dogfood.sh` and `ci.yml` (no GitHub run available yet; verified for real after the push).

**How to verify by hand:**

- `curl` with `runAttempt=2147483648` → `400`.
- Dashboard search for `_` → only names that contain an underscore.

## Tests expected

- **Unit:** contracts schema (D-04); the search-escaping helper (D-03).
- **Integration:** search through the HTTP seam (D-03); a failing Report's stored error (D-06).
- **Shell test:** the composite action script with a non-ASCII branch (D-08), extending the existing AC-30 test.

## Design notes

- **ReportIntake** / contracts, **FlakeAnalysis** (search), **ReportProcessing** (error text), `.github/actions/submit-report`, `scripts/dogfood.sh`.
- Design §5 (error envelope: no internals), §7 (secrets).

## Definition of done

- [ ] Each acceptance check above has a passing test, with the AC ID (or defect ID) in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests green; E2E green if the dashboard or demo is touched.
- [ ] `docs/04-validation.md`: the rows for the requirements and defects listed under "Requirements covered" updated to their new status (✅ where fixed), with evidence; each fixed defect ID marked fixed in the debt table (§7) with this ticket number. Keep the original finding text visible.
- [ ] `docs/02-srs.md` traceability matrix updated if test files changed; an SRS history row only if a requirement changed.
- [ ] README updated if commands changed.
- [ ] One focused commit, Conventional Commits, referencing this ticket.

## Comments

