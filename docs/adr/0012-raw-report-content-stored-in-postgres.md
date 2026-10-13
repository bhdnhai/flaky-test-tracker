# Raw Report content is stored in PostgreSQL, in its own table

Status: accepted

## Context

ADR-0003 makes the raw Report the source of truth and requires it to be retrievable unchanged (FR-11). Reports are at most 10 MB (FR-09). The expected volume is tens to a few hundred per Project per day (SRS §11), and there is no retention policy in iteration 1. The company's stack includes S3.

## Considered options

- **S3-compatible object storage (MinIO locally, S3 in production).** This is the production-scale shape for blobs: cheap storage, lifecycle rules for retention, and no database bloat. But it adds a container and credentials locally, and writing the Report row and the blob is no longer atomic. A crash between the two writes leaves either an orphaned blob or a Report without content, so we'd need a cleanup or ordering protocol.
- **The local filesystem (a Docker volume).** No extra service. But it is not atomic with the row either, and it ties the deployment to a single host and a single volume.
- **A `bytea` column in a separate `report_content` table, one row per Report.** (chosen)

## Decision

Raw content is stored in a `report_content(report_id, body)` table, inserted in the same transaction as the `report` row. Content lives in its own table so list and status queries never touch the blobs.

## Consequences

- A Report can't exist without its content, and there is no consistency protocol to write.
- No extra infrastructure locally.
- Database size grows with retained Reports, which affects backups and restore time. At about 300 Reports/day of 100 KB that's roughly 1 GB per month, which is acceptable for iteration 1.
- When retention or volume makes database size a problem, content moves to S3 behind a `ReportContentStore` interface, together with a retention policy. The `report` row keeps a pointer to the object instead of the bytes.
