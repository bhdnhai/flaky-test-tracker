# Integration tests run against a real PostgreSQL started by Testcontainers

Status: accepted

## Context

The core behaviour lives in the database:
- the `SKIP LOCKED` claim;
- the unique constraints that make processing idempotent and detect duplicates;
- the Flake aggregation query.

Mocking the database would test our assumptions about PostgreSQL rather than PostgreSQL itself. Integration tests must give the same result on a laptop and in GitHub Actions, and must not interfere with the demo data a developer has in their local stack.

## Considered options

- **Mock the repositories or the Prisma client.** Fast, but the queries and constraints that carry the behaviour would be exactly the parts not tested.
- **Use the `docker compose` database.** No extra tooling. But it is shared, stateful and possibly holding demo data, so tests could collide with each other or with the developer's environment. CI would have to start the full stack first.
- **An in-process PostgreSQL emulation (pg-mem or PGlite).** Fast and needs no Docker. But `SKIP LOCKED`, concurrency and some SQL behave differently or aren't supported, and those are what we most need to test.
- **Testcontainers.** Each integration test run starts a throwaway `postgres:18` container and applies the real migrations. (chosen)

## Decision

Integration tests use `@testcontainers/postgresql`. One container per test run. Each test file gets its own database, created from a template database that has the migrations applied, so files can run in parallel without sharing state.

## Consequences

- The tests exercise the real SQL, constraints and locking. Docker is already required (NFR-13), so nothing new is installed.
- The first run pulls the image, and container start-up adds a few seconds per run.
- GitHub-hosted Ubuntu runners have Docker, so the same tests run unchanged in CI.
