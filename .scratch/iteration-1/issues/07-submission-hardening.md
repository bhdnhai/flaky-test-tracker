# 07 — Submission hardening: size, type, XML safety, duplicates

Status: resolved
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

- [x] **AC-08** (FR-09). **Given** an empty body, **then** `400 EMPTY_REPORT`. **Given** a body of 10 MB + 1 byte, **then** `413 REPORT_TOO_LARGE`. **Given** `Content-Type: application/json`, **then** `415 UNSUPPORTED_MEDIA_TYPE`.
- [x] **AC-09** (FR-10, NFR-07). **Given** a body that is truncated XML, a body whose root is `<html>`, or a body containing `<!DOCTYPE … SYSTEM "file:///etc/passwd">`, **then** each gets `422 MALFORMED_REPORT`, and no file is read.
- [x] **AC-10** (FR-12). **Given** a Report R was accepted for Commit C, **when** the identical body is submitted again for C, **then** the response is `200` with R's ID and `duplicate: true`, and the Project still has one Report. **When** the identical body is submitted for a different Commit D, **then** it gets `202` with a new ID.

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

- [x] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [x] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [x] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below. (N/A — see Comments: the `bodyParser: false` fix completes design §5, it doesn't contradict it.)
- [x] README updated if setup, run or test commands changed. (N/A — no command changed.)
- [x] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

Built: `xmlPreCheck` (DOCTYPE/well-formedness/root, unit-tested on crafted inputs) run from the
controller after the commit/metadata pipes; a `ReportBodyGuard` for the Content-Type/empty-body
checks, run before them, so the guard → pipe → handler sequence matches design §5's order; the
intake service catches the `(project, commit, hash)` unique violation and re-reads the existing
Report for the `200 duplicate: true` response.

Deviation: Nest's default body parser was enabled globally and would JSON-parse a wrong-Content-Type
body itself (a generic 400) before the intended 415 ever ran. Disabled it (`bodyParser: false` in
`app.ts`); the submission route is the app's only route with a body, and design §5 already called
for a route-scoped raw parser only, so this completes rather than changes the design.

No follow-ups.
