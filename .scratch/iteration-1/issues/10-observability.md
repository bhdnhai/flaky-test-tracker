# 10 — Observability: request IDs, structured logs, health

Status: resolved
Priority: must
Blocked by: 03

## Goal

An Operator can follow one submission from its HTTP request to its final processing state in the logs, and can tell whether the service can reach its database.

## Requirements covered

NFR-06 (log part), NFR-10, NFR-11 (503 path). ACs: AC-38, AC-05 (token never logged).

## Scope

### In

- nestjs-pino in `api`, `worker` and `cli`; JSON logs.
- `X-Request-Id`: accepted if present, else generated; echoed on every response and in the error envelope's `requestId`.
- One log line per state change: `reportId`, `from`, `to`, `attempt`, `durationMs`.
- pino `redact` for `req.headers.authorization`.
- `/health` returns 503 with the envelope when the database is down (if not already complete from 01).

### Not in this ticket

- Metrics, tracing, alerting (design §9, production only).

## Acceptance checks

- [x] **AC-38** (NFR-10, NFR-11). Every HTTP response has an `X-Request-Id` header that matches a JSON log line. `GET /health` returns `200` with the database up and `503` with it stopped.
- [x] **AC-05** (FR-06, NFR-06). **Given** a submission with no `Authorization` header, a malformed one, or an unknown token, **then** each gets `401 UNAUTHORIZED` with the same message, no Report is stored, and the token value doesn't appear in the logs.

**How to verify by hand:**

- `curl -i -X POST … -H 'X-Request-Id: demo-1'` → the response has `X-Request-Id: demo-1`; `docker compose logs api worker | grep demo-1` and the Report ID show the request and its state changes; no `ftt_` string appears in the logs.

## Tests expected

- **Integration:** response header and log line match (capture the logger output) (AC-38); token absent from captured logs (AC-05); `/health` 503 with a stopped container (AC-38).
- **E2E:** none.

## Design notes

- Module: **Platform**. Design §9.

## Definition of done

- [x] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [x] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [x] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [x] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [x] README updated if setup, run or test commands changed.
- [x] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

Built: nestjs-pino wired via `PlatformModule` (shared by `api`/`worker`/`cli`); `X-Request-Id`
accepted-or-generated and echoed through pino-http's `genReqId`; `req.headers.authorization`
redacted; one log line per Report state change in `ReportIntakeService`/`ReportProcessingService`,
correlated to the originating HTTP request automatically via pino's AsyncLocalStorage context.
New tests: `apps/api/test/observability.int.test.ts`.

Deviation: `cli.ts` is not wired to `useLogger()` — its stdout is a scripted contract
(`scripts/demo.sh` reads the last line for the token), so it keeps plain `console.log`. No
SRS/design change needed: nestjs-pino is still present in its shared module graph.
