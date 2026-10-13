# Request and response contracts are shared as Zod schemas

Status: accepted

## Context

The dashboard and the API exchange about six JSON shapes (SRS §9.2), and the API must validate every query parameter (FR-07, FR-08, FR-24). Both sides are TypeScript in one repository (ADR-0007). The only external client, CI, uses the documented `curl` submission, not generated code.

## Considered options

- **OpenAPI generated from NestJS decorators (`@nestjs/swagger`), with TypeScript types generated for the web app (`openapi-typescript`).** This produces a published specification and fits ecosystems with clients in several languages. But types are described twice (DTO classes plus decorators), there's a code-generation step, and the spec only validates if the decorators match the validation, which is a well-known source of drift.
- **class-validator DTOs, with types hand-copied into the web app.** The default style in Nest. Duplicated types drift.
- **A `packages/contracts` workspace of Zod 4 schemas.** The API validates with them at runtime; the web app imports the inferred types and validates responses. (chosen)

## Decision

`packages/contracts` exports Zod schemas and inferred types for:
- query parameters;
- response bodies;
- the error envelope and its `code` values.

The API validates through a small Nest pipe that calls `schema.parse`. We don't use `nestjs-zod`, because it doesn't support NestJS 12. The web client parses responses with the same schemas.

## Consequences

- One source of truth that is both runtime validation and compile-time types, with no generation step.
- No published OpenAPI document. Zod 4 can emit JSON Schema (`z.toJSONSchema`), so one can be produced later if an external consumer appears.
- Both apps depend on the contracts package. A breaking change shows up as a type error in the same commit.
