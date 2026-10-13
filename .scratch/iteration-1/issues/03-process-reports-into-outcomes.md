# 03 — Worker processes Reports into Tests and Outcomes

Status: ready-for-agent
Priority: must
Blocked by: 02

## Goal

Every `pending` Report is processed by the worker into Tests and Outcomes, and the Reports page shows it as `processed`.

## Requirements covered

FR-13, FR-14, FR-15, FR-16; NFR-12 (coverage gate on the JUnit module). ACs: AC-11, AC-12, AC-39 (coverage part).

## Scope

### In

- **JUnit** module (pure, no I/O): `interpret(xml)` → test cases with `classname`, `name`, result, failure message (message attribute + text of the first failure/error, truncated to 8 KB on a UTF-8 boundary); `hostname` ignored. Parse with fast-xml-parser, entities off.
- **ReportQueue** Postgres adapter: `claimNext(now)` with `FOR UPDATE SKIP LOCKED`, `complete(id, result)`. Happy path only.
- **ReportProcessing**: `processNext(now)`: claim → load content → interpret → in one transaction upsert Tests, insert Outcomes (`ON CONFLICT DO NOTHING`), set `processed`.
- `worker` entry point and Compose service (same image), polling every 500 ms, with state-change log lines.
- Migration: `test`, `outcome` (with copied `project_id`, `commit_sha`, `received_at`) and design §6 indexes.
- Unit fixtures: the prototype's real XML samples (Vitest, Playwright single and multi-project, jest-junit, retries), copied from branch `prototype/reporter-output-and-flakiness`.
- Coverage threshold ≥ 90% lines on the JUnit module, enforced in CI.

### Not in this ticket

- Collisions (08): duplicate identities in one Report may be handled naively here; 08 makes them correct. Document the gap in the module until then.
- Retries, back-off, `failed`, claim expiry (09).
- Any Flake logic (04).

## Acceptance checks

- [ ] **AC-11** (FR-14, FR-15, FR-16). **Given** a Vitest Report with one passing, one `<failure>`, one `<error>` and one `<skipped>` test case, **when** it is processed, **then** 4 Tests exist with `classname`/`name` exactly as in the XML, their Outcomes are passed, failed, failed and skipped, and both failed Outcomes have a failure message.
- [ ] **AC-12** (FR-16). **Given** a `<failure>` whose combined message is 20 KB of multi-byte UTF-8, **when** it is processed, **then** the stored failure message is ≤ 8 KB and is valid UTF-8.
- [ ] **AC-39** (NFR-12). CI runs lint and typecheck with 0 errors, and the coverage report for the JUnit interpretation module is ≥ 90% lines.

**How to verify by hand:**

- Submit a Vitest Report as in 02; within a second the Reports page shows `processed`.
- `docker compose exec db psql -U … -c "select result, count(*) from outcome group by 1"` shows the expected counts.

## Tests expected

- **Unit:** JUnit module against every prototype sample: identity exactly as reported, failure/error → failed, skipped, the 8 KB truncation with multi-byte input (AC-11, AC-12); coverage ≥ 90% (AC-39).
- **Integration:** submit → `processNext` → Tests and Outcomes exist; the Report is `processed` (AC-11 end to end).
- **E2E:** none new (covered in 06 and 11).

## Design notes

- Modules: **JUnit** (the deepest module; keep its interface to `interpret`), **ReportQueue** (seam), **ReportProcessing**.
- ADRs: 0004, 0005 (identity, `hostname` ignored), 0006 (worker process), 0011 (queue on the `report` table).
- Design §4 module table, §6 processing transaction and indexes.

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
