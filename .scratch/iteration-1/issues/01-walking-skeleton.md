# 01 — Walking skeleton

Status: resolved
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

- [x] Given a fresh clone, when `docker compose up -d --build` runs, then http://localhost:8080 shows the API status as ok.
- [x] Given the stack is running, when `GET /health` is called, then it returns `200 {"status":"ok"}`; with the database stopped it returns `503` with the error envelope.
- [x] Given the repository, when `npm run lint`, `npm run typecheck`, `npm test` run, then all pass, and CI runs the same jobs.

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

- [x] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [x] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [x] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [x] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [x] README updated if setup, run or test commands changed.
- [x] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

### 2026-10-13: resolved

**Built**
- npm workspaces: `packages/contracts`, `apps/api` and `apps/web`, all ESM, on Node 22.23 and TypeScript 6.0.
- Contracts: Zod schemas for the error envelope, the error codes and the health response. They expose a `source` export condition, so tsc, Vite and Vitest read the TypeScript directly while Node runs the built `dist`.
- API, Platform module:
  - a Zod-validated `AppConfig`;
  - `PrismaService` using the `pg` adapter;
  - `ErrorEnvelopeFilter`, which handles `ApiError`, Nest `HttpException`s and http-errors from Express middleware (body-parser `413`); anything else becomes `500 INTERNAL_ERROR`;
  - `GET /health` running `SELECT 1`, returning `200` or `503 UNAVAILABLE`;
  - a `createApp(config)` factory shared by `main.ts` and the tests.
- First Prisma migration: the `project` table only.
- Dashboard: an MUI app shell with React Router and TanStack Query. The `ApiStatus` chip in the header calls `/health` through `shared/api`, whose client parses responses with the contracts and turns envelopes into `ApiRequestError`.
- `docker-compose.yml`:
  - `db`, then the one-shot `migrate`, then `api`, then `web` (nginx on :8080, proxying `/api/` and `/health`);
  - health checks on `db` and `api`;
  - `service_completed_successfully` on `migrate`.
- Tests:
  - unit: `apps/api/src/platform/error-envelope.filter.test.ts`, `apps/web/src/shared/api/client.test.ts`;
  - integration (Testcontainers, a template database cloned per file): `apps/api/test/health.int.test.ts`;
  - E2E: `apps/web/e2e/smoke.spec.ts`.
- ESLint (type-checked) and Prettier. The deep-import rule derives one zone per folder under `apps/api/src`.
- `.github/workflows/ci.yml`: jobs `install`, `lint-typecheck` (also runs `format:check`), `unit` and `integration`.

**Deviations and discoveries.** These are written into design §2, §4, §8 and §10, and SRS v1.2 history.
- **Node ≥ 22.22, not ≥ 22.12.** React Router 8.4 and Testcontainers 12.2 declare `node >= 22.22`. The design only checked Prisma's minimum. `.nvmrc` is now 22.23.3, `engines` is `>=22.22 <23`, and the images use `node:22.23-alpine`.
- **`eslint-plugin-import-x` instead of `eslint-plugin-import`** (ADR-0007 names the latter). `eslint-plugin-import` 2.32 has no ESLint 10 support.
- **Test naming (design §8).** This ticket asks for tests that no AC covers, such as the `500` mapping. The rule now allows the most specific FR/NFR, SRS section or ADR ID in that case.
- **Stubbing `fetch` (design §8).** The rule said only time may be replaced. The web client's unit tests stub `fetch`, which is the network boundary, so the rule now names that exception.
- **nginx also proxies `/health`.** The design mentioned only `/api`, but the ticket's hand check uses `localhost:8080/health`.
- **`db` is published on host port 5433, not 5432.** A native PostgreSQL on the developer laptop shadowed `127.0.0.1:5432`, and host-side `prisma migrate deploy` hit it instead of the container.
- **No `@nestjs/config`.** Config is one Zod schema provided by value. Nothing more was needed.
- **The 503 integration test points the app at a refusing port** instead of stopping the shared container, so parallel test files keep their database. The hand check (`docker compose stop db`) confirmed the real case: `503` in about 50 ms.
- **The code review caught a real bug.** body-parser's `413` (an http-errors error, not a Nest `HttpException`) came back as `500`. It is fixed and has a test.

**Follow-ups found (not done here)**
- `npm audit` reports 4 high-severity issues, all transitive in the `prisma` CLI (`deepmerge-ts`; `mysql2`, which is never loaded for PostgreSQL). The only offered fix downgrades to Prisma 6, which conflicts with ADR-0008. Recheck when 7.10.x gets a patch.
- nginx `client_max_body_size` defaults to 1 MB, and Reports can be up to 10 MB (design §5). Ticket 02 or 07 has to raise it, or large submissions will get nginx's HTML `413` instead of the envelope.
- SRS §9.1 has no code for client errors outside its table (`403`, `405`, `429`). The filter returns them as `500 INTERNAL_ERROR`. None of them can happen today, but the SRS should decide this if a route can ever produce one.

