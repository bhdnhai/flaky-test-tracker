# 07 — Submission hardening: size, type, XML safety, duplicates

Status: ready-for-agent
Priority: must
Blocked by: 02

## Goal

Invalid submissions fail fast with the right error code, XML can't be used for XXE, and resubmitting the same Report is a safe no-op.

## Requirements covered

FR-09, FR-10, FR-12; NFR-07. ACs: AC-08, AC-09, AC-10.

## Scope

### In

- Complete design §5 check order: `415` for other content types, `413` before buffering beyond 10 MB (the body-parser limit mapped to the envelope), `400 EMPTY_REPORT`, then DOCTYPE rejection, well-formedness (`XMLValidator`), root `testsuites`/`testsuite` → `422 MALFORMED_REPORT`.
- Duplicate detection: SHA-256 of the body; unique (Project, Commit, hash); catch the unique violation → `200 {id, processingState, duplicate: true}`. Race-safe under concurrent identical submissions.

### Not in this ticket

- Rate limiting (SRS §14).

## Acceptance checks

- [ ] **AC-08** (FR-09). **Given** an empty body, **then** `400 EMPTY_REPORT`. **Given** a body of 10 MB + 1 byte, **then** `413 REPORT_TOO_LARGE`. **Given** `Content-Type: application/json`, **then** `415 UNSUPPORTED_MEDIA_TYPE`.
- [ ] **AC-09** (FR-10, NFR-07). **Given** a body that is truncated XML, a body whose root is `<html>`, or a body containing `<!DOCTYPE … SYSTEM "file:///etc/passwd">`, **then** each gets `422 MALFORMED_REPORT`, and no file is read.
- [ ] **AC-10** (FR-12). **Given** a Report R was accepted for Commit C, **when** the identical body is submitted again for C, **then** the response is `200` with R's ID and `duplicate: true`, and the Project still has one Report. **When** the identical body is submitted for a different Commit D, **then** it gets `202` with a new ID.

**How to verify by hand:**

- `curl` with `-H 'Content-Type: application/json'` → 415; a 10 MB + 1 byte file → 413; a file with `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>` → 422.
- Post the same file twice for the same Commit → 202 then 200 with `duplicate: true` and the same `id`.

## Tests expected

- **Unit:** the synchronous XML pre-check (DOCTYPE, well-formedness, root) on crafted inputs.
- **Integration:** AC-08, AC-09 (also assert no Report is stored), AC-10 including two concurrent identical submissions → one Report.
- **E2E:** none.

## Design notes

- Module: **ReportIntake**.
- ADRs: 0003, 0012. Design §5 (check order), §6 (intake transaction and duplicate handling), §7 (XML handling).

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
