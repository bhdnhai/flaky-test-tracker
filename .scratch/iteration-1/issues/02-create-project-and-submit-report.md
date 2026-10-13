# 02 — Operator creates a Project; CI submits a Report; the Reports page shows it

Status: resolved
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

- [x] **AC-01** (FR-01, FR-02, FR-04). **Given** no Project named `web-app`, **when** the Operator runs `create-project web-app`, **then** the command exits with 0 and prints a token starting with `ftt_`, and the stored Project contains that token's SHA-256 hash, not the token itself.
- [x] **AC-02** (FR-01, FR-04). **Given** a Project `web-app` exists, **when** the Operator runs `create-project web-app` or `create-project Web_App`, **then** the command exits non-zero with a one-line error, and no Project is created.
- [x] **AC-03** (FR-03, FR-06). **Given** `web-app` with token T1, **when** the Operator runs `rotate-token web-app` and gets T2, **then** a submission with T1 gets `401` and the same submission with T2 gets `202`.
- [x] **AC-04** (FR-05, FR-11, FR-13). **Given** a valid token, **when** CI submits a Report with `commit=<40-hex>`, **then** the response is `202` with an ID and `processingState: "pending"`, and the stored raw content is byte-identical to the request body.
- [x] **AC-05** (FR-06, NFR-06). **Given** a submission with no `Authorization` header, a malformed one, or an unknown token, **then** each gets `401 UNAUTHORIZED` with the same message, no Report is stored, and the token value doesn't appear in the logs.
- [x] **AC-06** (FR-07). **Given** `commit` is missing, `abc123`, 39 hex characters, or 40 characters containing `g`, **then** each gets `400 INVALID_COMMIT`. **Given** a 40-character SHA in uppercase, **then** it gets `202` and is stored in lowercase.
- [x] **AC-07** (FR-08). **Given** `runAttempt=0` or `runAttempt=x`, **then** the response is `400 VALIDATION_ERROR`. **Given** `branch=main&runId=123&runAttempt=2&job=test`, **then** those values appear on the Report in the Reports list.
- [x] **AC-26** (FR-26, FR-27, FR-30). **Given** Projects `web-app` and `api`, **when** the Projects page is opened, **then** both are listed by name. Opening `web-app` shows its Flaky Tests page, and from there its Reports page lists its Reports newest first with their processing states.

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

- [x] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [x] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [x] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [x] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [x] README updated if setup, run or test commands changed.
- [x] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

### 2026-10-13: resolved

**Built**
- **Projects** module (`apps/api/src/projects/`): `create`, `rotateToken`, `authenticate`, `list`, `get`; `ftt_` + 32 random bytes base64url tokens, SHA-256 hashed, only the hash stored.
- CLI entry point (`apps/api/src/cli.ts`, Nest standalone context): `create-project <name>`, `rotate-token <name>`; 0/1 exit codes with a one-line message; runs via `docker compose exec api node dist/cli.js ...`.
- **ReportIntake** module: `UploadTokenGuard` (same `401` for missing/malformed/unknown token), commit and metadata Zod schemas from `packages/contracts`, a scoped `express.raw()` parser on `/api/v1/reports`, one transaction inserting `report` + `report_content`, `202 {id, processingState, duplicate: false}`.
- Migration `add_report_tables`: `report` and `report_content` with design §6's columns, including the queue columns (`claimed_at`, `next_attempt_at`) ticket 03 will use.
- Read API: `GET /api/v1/projects`, `GET /api/v1/projects/{id}/reports`, `GET /api/v1/projects/{id}/reports/{reportId}`, all validating path params and mapping an unknown or cross-Project id to `404`.
- Dashboard: Projects page, a Flaky Tests placeholder page (ticket 04 fills it in) that links to Reports, and the Reports page with FR-30's columns.
- Tests: unit (token generation/hashing, commit/metadata schema boundaries), integration (Testcontainers: Projects via the Nest application context, submission, Read API, ownership checks), one E2E test (Projects → Reports shows a submitted Report).

**Discoveries — design corrected (SRS v1.3, design §4).** The code-review Standards pass (`mattpocock-skills:code-review`) caught that the design's module diagram never named which module owns Report *reads*: `ReadApi`'s row says "Must NOT know about: SQL", but nothing else claimed the `report` table's read side (`ReportQueue` only gets its lifecycle methods in ticket 03). The first pass had `ReadApi` query `PrismaService` directly to cover the gap. Fixed by giving `ReportIntakeService` — which already owns the table's writes — two read methods (`listForProject`, `findOne`), and `ReadApi` now calls those instead. Design §4 updated (the module diagram gets a `readapi --> intake` edge; `ReportIntake`'s documented interface lists the two methods); SRS document history gets a v1.3 line.

**Other review findings fixed (no doc change needed):**
- Path parameters (`projectId`, `reportId`) now go through `ZodPipe(z.uuid(), 'NOT_FOUND')` — design §7 asks for Zod validation on every HTTP input, including path params, and a malformed id used to reach Prisma unchecked and come back as an uncaught `500` instead of a clean `404`.
- `rawBodyOf()` used to silently fall back to an empty buffer when the raw-body middleware hadn't captured a Buffer (wrong `Content-Type`), so a misconfigured CI client got a `202` with nothing actually stored — silently breaking FR-11's byte-identical promise. It now throws `400 VALIDATION_ERROR` instead of fabricating an empty success. This is a narrower guard than ticket 07's `415 UNSUPPORTED_MEDIA_TYPE`, which still has its own job to do (an exact content-type check with its own code).
- The `app.ts` comment claiming the 10 MB raw-body limit "isn't enforced yet" was wrong: an oversized body already gets a correct `413 REPORT_TOO_LARGE` today, as a side effect of `ErrorEnvelopeFilter`'s existing framework-error mapping. Comment corrected; FR-09's other checks (empty body, `415`) are still ticket 07's.
- A test title didn't start with an AC/FR/NFR/SRS/ADR id per design §8's naming rule; renamed.
- Duplicated test bootstrap (`createApp` + `createTestDatabase` + sample XML) across two integration test files extracted to `apps/api/test/support/http.ts` and `.../junit-fixtures.ts`.
- AC-07's "those values appear on the Report in the Reports list" previously only had a direct-Prisma assertion; added `apps/api/test/read-api.int.test.ts`'s own AC-07 test that checks the actual `GET .../reports` response.

**Review findings deliberately not fixed, left for ticket 07 (noted in SRS §10's existing risk list, not a new one):** the unique constraint on `(project_id, commit_sha, content_hash)` the migration adds for FR-12 has no catch yet — an identical resubmission throws an uncaught Prisma `P2002` → `500` instead of ticket 07's real duplicate response. Implementing that now would mean building FR-12 early; the ticket's own "Not in this ticket" list already names "duplicates (07)".

**Out-of-scope follow-ups found (not done here, for the Operator to decide on new tickets):**
- Ticket 07 should know the size-limit's `413` path already works end-to-end (see above) — less of FR-09 is actually left to build than the SRS implies.
- Ticket 07's duplicate handling should also add the `report.create` `P2002` catch described above before CI retries become common.
