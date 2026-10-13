# The `report` table is the job queue, claimed with `SKIP LOCKED`

Status: accepted

## Context

ADR-0003 settled asynchronous processing with a durable queue in the application's database. The SRS defines the Report lifecycle precisely:
- `pending → processing → processed | failed`;
- 3 attempts in total with increasing delay;
- a claim expires after 60 s if its worker dies.

The processing state is part of the domain: it is shown on the Reports page, and the demo waits on it. There is exactly one kind of job.

## Considered options

- **pg-boss.** A mature PostgreSQL-backed queue with retries, back-off and expiry built in. But it keeps its own job table. The Report's processing state would then live in two places (the pg-boss job and `report.processing_state`) that must be kept in sync in every path: retry, expiry, final failure, reprocessing. That's a class of bugs we would add in exchange for features we'd only partly use.
- **graphile-worker.** The same trade-off as pg-boss, plus its own migration schema.
- **SQS (or another external broker).** The production-grade choice at scale, but it needs cloud resources or an emulator locally (ADR-0003) and still needs the state kept in sync with the database.
- **Use the `report` table itself.** A worker claims the oldest due Report with `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING …`. Attempts, the next due time and the claim time are columns on the same row. (chosen)

## Decision

The Report row *is* the job:
- claiming sets `processing`, records the claim time and counts an attempt;
- completion, retry scheduling and final failure are single-row updates in the same transaction as the Outcomes;
- a periodic sweep returns expired claims to `pending`, or to `failed` once 3 attempts are used.

All of this sits behind a small `ReportQueue` interface (`enqueue` happens implicitly on insert; `claimNext`, `complete`, `fail`, `releaseExpired`).

## Consequences

- One source of truth for the processing state. The SRS state machine maps one-to-one onto row updates.
- `SKIP LOCKED` lets several worker processes run in parallel without double-processing, so horizontal scaling of workers needs no change.
- We own about 60 lines of queue logic and must test retry, back-off and expiry ourselves (ADR-0010).
- Polling every 500 ms adds up to 0.5 s of latency, which is well within NFR-02.
- Moving to SQS later replaces the `ReportQueue` adapter. The Report row would remain the source of truth for the state, and the queue would only carry IDs.
