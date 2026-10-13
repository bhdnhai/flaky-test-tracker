# Accept Reports asynchronously and keep the raw Report

Status: accepted

## Context

CI submits a Report at the end of a job. The submission must be fast and must not fail the job because of our own problems, such as a slow parse or a bug in the analysis. Reports from large suites can be several megabytes. The flakiness rule (ADR-0004) is the part of the product most likely to change, and when it does we want to re-analyse history instead of losing it.

## Considered options

- **Parse during the request and reply `201` with the parsed result.** This is the simplest option: no queue and no extra state. But submission time grows with Report size, a parser bug makes CI fail, and once we've extracted results the original document is gone, so a changed rule can't be re-applied to history.
- **Store the raw Report, reply `202 Accepted`, process it in the background using a queue managed by AWS (SQS with Lambda or EventBridge).** This is the production-grade shape and the company's stack uses it. But it needs cloud resources or emulators just to run locally, and iteration 1 has no volume that requires it.
- **Store the raw Report, reply `202 Accepted`, process it in the background using a durable job queue in the same database.** (chosen)

## Decision

A Report is stored as received and acknowledged with `202 Accepted`. A background worker parses it and records the Outcomes. The raw Report is the source of truth, and parsed Outcomes can be rebuilt from it. In iteration 1 the job queue lives in the application's own database.

## Consequences

- CI is decoupled from processing time and from processing failures.
- A Report goes through processing states (received → processed / failed), and the dashboard has to handle "not processed yet".
- File storage is a real requirement, not decoration, because raw Reports are kept.
- Moving to SQS (or similar) is the obvious path when submission volume or worker isolation requires it. The worker sits behind a queue interface so that swap stays contained.
