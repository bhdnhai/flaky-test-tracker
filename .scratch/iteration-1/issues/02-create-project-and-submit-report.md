# 02 — Operator creates a Project; CI submits a Report; the Reports page shows it

Status: ready-for-agent
Priority: must
Blocked by: 01

## Goal

An Operator creates a Project and gets its Upload Token; a CI Pipeline submits a Report with that token and a Commit; anyone can see the Report on the Project's Reports page in state `pending`.

## Requirements covered

FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-11, FR-26, FR-30 (pending state only); NFR-06. ACs: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-26 (Projects → Reports navigation part).

## Scope

### In

- **Projects** module: `create`, `rotateToken`, `authenticate`, `list`, `get`. Token = `ftt_` + 32 random bytes base64url; only the SHA-256 hash is stored.
- CLI entry point (Nest standalone context) with `create-project <name>` and `rotate-token <name>`; exit codes per FR-04; usable via `docker compose exec api`.
- **ReportIntake** module, minimal path: `UploadTokenGuard`, `commit` and metadata validation (contracts), raw body accepted as `application/xml`/`text/xml`, insert `report` + `report_content` in one transaction, `202 {id, processingState: "pending", duplicate: false}`.
- Migration: `report`, `report_content` (design §6 columns, including the queue columns for later).
- Read API: `GET /api/v1/projects`, `GET /api/v1/projects/{id}/reports`, `GET /api/v1/projects/{id}/reports/{reportId}`.
- Dashboard: Projects page (FR-26) and Reports page (FR-30 columns; state is always `pending` for now).

### Not in this ticket

- Processing the Report (03).
- Size limit, content-type `415`, empty body, XML checks, duplicates (07).
- Request-ID logging and token redaction in logs (10). Tokens must still never be logged by our own code.

## Acceptance checks

- [ ] **AC-01** (FR-01, FR-02, FR-04). **Given** no Project named `web-app`, **when** the Operator runs `create-project web-app`, **then** the command exits with 0 and prints a token starting with `ftt_`, and the stored Project contains that token's SHA-256 hash, not the token itself.
- [ ] **AC-02** (FR-01, FR-04). **Given** a Project `web-app` exists, **when** the Operator runs `create-project web-app` or `create-project Web_App`, **then** the command exits non-zero with a one-line error, and no Project is created.
- [ ] **AC-03** (FR-03, FR-06). **Given** `web-app` with token T1, **when** the Operator runs `rotate-token web-app` and gets T2, **then** a submission with T1 gets `401` and the same submission with T2 gets `202`.
- [ ] **AC-04** (FR-05, FR-11, FR-13). **Given** a valid token, **when** CI submits a Report with `commit=<40-hex>`, **then** the response is `202` with an ID and `processingState: "pending"`, and the stored raw content is byte-identical to the request body.
- [ ] **AC-05** (FR-06, NFR-06). **Given** a submission with no `Authorization` header, a malformed one, or an unknown token, **then** each gets `401 UNAUTHORIZED` with the same message, no Report is stored, and the token value doesn't appear in the logs.
- [ ] **AC-06** (FR-07). **Given** `commit` is missing, `abc123`, 39 hex characters, or 40 characters containing `g`, **then** each gets `400 INVALID_COMMIT`. **Given** a 40-character SHA in uppercase, **then** it gets `202` and is stored in lowercase.
- [ ] **AC-07** (FR-08). **Given** `runAttempt=0` or `runAttempt=x`, **then** the response is `400 VALIDATION_ERROR`. **Given** `branch=main&runId=123&runAttempt=2&job=test`, **then** those values appear on the Report in the Reports list.
- [ ] **AC-26** (FR-26, FR-27, FR-30). **Given** Projects `web-app` and `api`, **when** the Projects page is opened, **then** both are listed by name. Opening `web-app` shows its Flaky Tests page, and from there its Reports page lists its Reports newest first with their processing states.

**How to verify by hand:**

- `docker compose exec api node dist/cli.js create-project web-app` prints `ftt_…`.
- `curl -X POST "localhost:8080/api/v1/reports?commit=$(git rev-parse HEAD)" -H "Authorization: Bearer ftt_…" -H "Content-Type: application/xml" --data-binary @some-junit.xml` returns `202`.
- The dashboard: Projects → web-app → Reports shows one `pending` Report with the short SHA.
- `rotate-token web-app`, then repeat the curl with the old token: `401`.

## Tests expected

- **Unit:** token generation (prefix, length) and hashing; commit and metadata schemas (AC-06, AC-07 boundary values).
- **Integration:** HTTP submission against Testcontainers (AC-04, AC-05, AC-06, AC-07, AC-03); CLI commands through the Nest application context (AC-01, AC-02, AC-03); stored raw bytes equal the request body (AC-04).
- **E2E:** Projects page → Reports page shows the submitted Report (the AC-26 part that doesn't need Flaky Tests; the Flaky Tests link is completed in 04).

## Design notes

- Modules: **Projects**, **ReportIntake**, **ReadApi**, CLI entry point, dashboard features `projects` and `reports`.
- ADRs: 0002 (Upload Token, no login), 0012 (raw content table), 0013 (contracts).
- Design §5 (submission check order, steps 1, 5 and 8 only), §6 (intake transaction), §7 (guard, ownership checks → 404).

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
