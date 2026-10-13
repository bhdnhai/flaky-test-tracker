# Modular monolith, deployed as separate api and worker processes

Status: accepted

## Context

The system has three entry points: HTTP (submission and the read API), background processing of Reports, and the Operator CLI. The SRS requires processing to be separable from submission: submissions must keep returning `202` while the worker is stopped (NFR-05, AC-18), and a worker killed mid-processing must not lose a Report (NFR-04, AC-17). The expected volume is a few hundred Reports a day per Project (SRS §11), and one engineer builds it in about two days.

## Considered options

- **One process: an HTTP server with an in-process background loop.** This is the simplest to run. But stopping or crashing the worker also stops the API, which breaks NFR-05. It also makes AC-17 and AC-18 impossible to exercise.
- **Separate services (a submission service and a processing service, for example a Lambda triggered by SQS).** This gives independent scaling and deploys. It costs two codebases or packages, a network contract between them, and cloud infrastructure or emulators locally, and nothing in the volume needs it.
- **One codebase organised as modules, built into one image, started as two processes (`api`, `worker`), plus a CLI entry point.** (chosen)

## Decision

One NestJS application with domain modules (see `docs/03-design.md` §4) and three entry points that share the same modules:
- `api`: HTTP;
- `worker`: the processing loop;
- `cli`: Operator commands run inside the deployment.

They communicate only through the database (ADR-0011).

## Consequences

- `api` and `worker` can be stopped, restarted and scaled independently, which satisfies NFR-04 and NFR-05 and makes them testable.
- One image, one dependency tree, one set of migrations.
- Module boundaries are enforced by convention and review, not by the network. A module may only import another module's public interface (its Nest module exports), never its internals.
- Splitting `worker` into its own service later is mechanical, because it already runs as a separate process and its only coupling is the queue interface.
