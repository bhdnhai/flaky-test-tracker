# Prisma 7 as the ORM, with typed raw SQL for the two hot queries

Status: accepted

## Context

The data model is small and relational (Project, Report, Test, Outcome; SRS §7). Most access is plain CRUD. Two queries carry the core behaviour and need PostgreSQL features directly:
- claiming the next Report with `FOR UPDATE SKIP LOCKED` (ADR-0011);
- the Flake aggregation for ranking and verdicts (computed on read, `docs/03-design.md` §6).

The company's stack lists TypeORM or Prisma.

## Considered options

- **TypeORM 1.x.** Decorator-based entities feel native in NestJS, and its query builder can express `SKIP LOCKED`. But query results are typed loosely, relations loaded lazily or eagerly are a common source of N+1 problems and surprises, and generated migrations need careful review.
- **A query builder without an ORM (Kysely or plain `pg`).** Full SQL control and good types with Kysely. But we'd hand-write migrations and the CRUD layer, and the company's stack names an ORM.
- **Prisma 7.10.** Schema-first, generated types for every query, mature migrations (`migrate dev` / `migrate deploy`), and from v7 a TypeScript query engine with the `pg` driver adapter, so no Rust binary to ship. `$queryRaw` with tagged templates covers the two hot queries. (chosen)

## Decision

Prisma 7.10 with `@prisma/adapter-pg`. The two hot queries are raw SQL, parameterised through tagged templates and wrapped behind their modules' interfaces. Pin `prisma` and `@prisma/client` to `7.10.x`: on the registry, `prisma@latest` currently points to an 8.0 release candidate.

## Consequences

- Type-safe CRUD and reliable migrations for the 90% that is ordinary.
- The two raw queries aren't checked by Prisma's types. Their result rows are validated with Zod inside the module, and both are covered by integration tests against real PostgreSQL (ADR-0010).
- Prisma's schema DSL replaces decorator entities, which some Nest developers find less familiar. Persistence stays inside each module's implementation, so this doesn't leak through interfaces.
