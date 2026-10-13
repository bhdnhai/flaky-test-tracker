# REST over HTTP/JSON for every interface; no gRPC

Status: accepted

## Context

The system has two kinds of clients:
- the **CI Pipeline**, which submits one XML document per job, typically using `curl` inside a GitHub Actions step;
- the **dashboard**, a browser application.

There is no service-to-service communication: `api` and `worker` share the database, not a network call (ADR-0006). The company's stack lists REST and gRPC.

## Considered options

- **gRPC.** Strongly typed contracts generated from `.proto`, efficient binary transport, and streaming. But browsers can't call gRPC directly (they would need gRPC-Web and a proxy), CI would need a generated client instead of a `curl` one-liner, and production would need HTTP/2 all the way through the load balancer. Its strengths (low-latency calls between internal services, streaming) answer problems this system doesn't have.
- **GraphQL.** Flexible reads for the dashboard. But there are only four read views with fixed shapes, and submitting a raw XML body doesn't fit GraphQL well.
- **REST over HTTP/JSON, versioned under `/api/v1`.** (chosen)

## Decision

REST for both the submission and the read API, with one JSON error envelope (SRS §9). Request and response shapes are shared as Zod schemas (ADR-0013).

## Consequences

- Submitting a Report is one `curl` command, and the dashboard uses `fetch`.
- No `.proto` toolchain.
- gRPC becomes the right choice if processing is split into internal services that call each other synchronously at high rates, for example a separate analysis service queried per request. Not before.
