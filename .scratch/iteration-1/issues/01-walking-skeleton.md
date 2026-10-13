# 01 — Walking skeleton

Status: ready-for-agent
Priority: must
Blocked by: none

## Goal

A running, tested, linted empty system: `docker compose up` brings up the database, migrations, the API and the dashboard, and the dashboard shows that the API is healthy.

## Requirements covered

Foundation for every ticket. Partially: NFR-11 (`GET /health` 200 path), NFR-12 / AC-39 (lint and typecheck part), NFR-13 (one-command start).

## Scope

### In

- npm workspaces monorepo per design §3: the API, dashboard and contracts workspaces, Node 22 (`.nvmrc`, `engines`), TypeScript 6.0.
- NestJS 12 API with platform basics: config from env, the global error-envelope filter (SRS §9.1), `GET /health` running `SELECT 1` (200 / 503).
- Prisma 7.10 (pinned) with the `pg` adapter; a first migration creating the `project` table only (later tickets add their own tables).
- React 19 + Vite 8 + MUI 9 dashboard with React Router and TanStack Query; one page that calls `/health` through the shared client and shows the status.
- The shared contracts workspace with Zod 4: the error envelope, error codes, the health response.
- `docker-compose.yml`: `db` (postgres:18), `migrate` (one-shot `prisma migrate deploy`), `api`, `web` (nginx serving the Vite build and proxying `/api`, port 8080). Health checks; `depends_on` with `service_completed_successfully` for migrate.
- Vitest in the API, dashboard and contracts; one integration test harness using Testcontainers (ADR-0010) exercising `/health`.
- One Playwright smoke test against the Compose stack: the page shows "API: ok".
- ESLint + Prettier, `lint`, `typecheck`, `format` scripts at the root; a lint rule against deep imports between API modules.
- `.github/workflows/ci.yml` with jobs: install, lint and typecheck, unit, integration.
- `.env.example`; README skeleton (what it is, quick start, how to run tests, links to docs).

### Not in this ticket

- The `worker` process and CLI entry point (02, 03).
- Any domain tables other than `project`.
- The e2e CI job (06).

## Acceptance checks

- [ ] Given a fresh clone, when `docker compose up -d --build` runs, then http://localhost:8080 shows the API status as ok.
- [ ] Given the stack is running, when `GET /health` is called, then it returns `200 {"status":"ok"}`; with the database stopped it returns `503` with the error envelope.
- [ ] Given the repository, when `npm run lint`, `npm run typecheck`, `npm test` run, then all pass, and CI runs the same jobs.

**How to verify by hand:**

- `docker compose up -d --build`, then open http://localhost:8080: the page shows "API: ok".
- `docker compose stop db`, then `curl -i localhost:8080/health` → `503` with the error envelope.
- `npm run lint && npm run typecheck && npm test` all pass.

## Tests expected

- **Unit:** the error-envelope filter maps an unknown error to `500 INTERNAL_ERROR` with no internals in the message.
- **Integration:** `/health` against a Testcontainers Postgres returns 200.
- **E2E:** Playwright smoke test: the dashboard shows the API status.

## Design notes

- Modules: **Platform** (database client, config, error envelope, health). Contracts workspace.
- ADRs: 0006 (process model; only `api` here), 0007 (npm workspaces), 0008 (Prisma pinned 7.10), 0010 (Testcontainers), 0013 (Zod contracts).
- Design §3 layout, §5 error handling, §10 local deployment, §11 CI (partial).

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
