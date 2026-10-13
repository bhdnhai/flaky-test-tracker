# Flaky Test Tracker

Collects JUnit test results from CI across many runs and identifies tests that pass and fail on the same Commit, so a team can tell flakiness apart from real breakage.

> Status: iteration 1 in progress. An Operator can create a Project and CI can submit a Report to it (see [`.scratch/iteration-1/`](.scratch/iteration-1/README.md) for what's landed ticket by ticket).

## Quick start

Requirements: Docker (with Compose v2). Node is needed only for development and tests.

```sh
docker compose up -d --build
open http://localhost:8080        # the header shows "API: ok"
```

`docker compose up` starts `db` (PostgreSQL 18), runs the one-shot `migrate` service (`prisma migrate deploy`), then starts `api` (NestJS) and `web` (nginx serving the dashboard and proxying `/api` and `/health` to the API) on port 8080.

```sh
curl -i localhost:8080/health     # 200 {"status":"ok"}; 503 with the error envelope if the database is down
docker compose down               # add -v to also delete the database volume
```

### Create a Project and submit a Report

The Operator CLI runs inside the `api` container (it has no network-facing surface, SRS §9.3):

```sh
docker compose exec api node dist/cli.js create-project web-app
# Created project "web-app" (<uuid>)
# ftt_<the Upload Token, shown only now>

docker compose exec api node dist/cli.js rotate-token web-app   # issues a new token; the old one stops working
```

CI submits a Report with that token and the Commit it was produced from:

```sh
curl -X POST "localhost:8080/api/v1/reports?commit=$(git rev-parse HEAD)" \
  -H "Authorization: Bearer ftt_…" \
  -H "Content-Type: application/xml" \
  --data-binary @some-junit.xml
# 202 {"id":"...","processingState":"pending","duplicate":false}
```

Open the dashboard: Projects → `web-app` → Reports shows the submitted Report (`pending` until ticket 03 adds processing).

## Development

Requirements: Node 22.22+ (see [`.nvmrc`](.nvmrc); `nvm use`) and Docker.

```sh
npm install
npm run lint          # ESLint (incl. the API module-boundary rule)
npm run typecheck     # tsc in every workspace
npm run format        # Prettier
npm test              # unit + integration tests
```

| Command                    | What it runs                                                                                                                                                           | Needs                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `npm run test:unit`        | Vitest unit tests in `apps/api`, `apps/web`, `packages/contracts`                                                                                                      | Node                           |
| `npm run test:integration` | API tests over HTTP against a throwaway PostgreSQL started by Testcontainers ([ADR-0010](docs/adr/0010-integration-tests-against-real-postgres-via-testcontainers.md)) | Docker                         |
| `npm run test:e2e`         | Playwright against the running Compose stack (`npx playwright install chromium` once)                                                                                  | `docker compose up -d --build` |

To run the API outside Docker, start only the database and point the API at it (see [`.env.example`](.env.example)):

```sh
docker compose up -d db
export DATABASE_URL=postgresql://ftt:ftt@localhost:5433/ftt
npm exec -w apps/api -- prisma migrate deploy
npm run start:dev -w apps/api     # http://localhost:3000/health
npm run dev -w apps/web           # http://localhost:5173, proxies /api and /health to :3000
```

## Repository layout

| Path                 | What                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/api`           | NestJS API; Prisma schema and migrations in `apps/api/prisma`                                       |
| `apps/web`           | React + Vite + MUI dashboard; Playwright tests in `apps/web/e2e`                                    |
| `packages/contracts` | Zod schemas shared by API and dashboard ([ADR-0013](docs/adr/0013-shared-zod-contracts-package.md)) |

## Documentation

- [Problem definition](docs/01-problem-definition.md)
- [Software requirements specification](docs/02-srs.md)
- [Solution design](docs/03-design.md) and [ADRs](docs/adr/)
- [Domain glossary](CONTEXT.md)
