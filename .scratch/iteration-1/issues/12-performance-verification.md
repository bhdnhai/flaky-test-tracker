# 12 — Performance verification

Status: resolved
Priority: must
Blocked by: 05

## Goal

The NFR targets are measured, not assumed: submission under load, processing time for a large Report, and read latency at the stated data volume.

## Requirements covered

NFR-01, NFR-02, NFR-03; assumption A10. ACs: AC-34, AC-35, AC-36.

## Scope

### In

- k6 script: 1 MB Reports at 10 requests/s for 60 s against the Compose stack; thresholds p95 < 300 ms, 0 non-2xx (AC-34); `workflow_dispatch` CI workflow plus a documented local command.
- Processing timing script: a 1,000-test-case Report, 20 submissions, p95 time to `processed` < 5 s (AC-35).
- Seed script for 10,000 Tests and 200,000 Outcomes in a disposable database; measure 100 requests to each read endpoint; p95 < 500 ms (AC-36).
- If AC-36 fails: implement the per-(Test, Commit) summary fallback inside **FlakeAnalysis** (design §6) and record the change in the SRS history and the design.
- Record the measured numbers in the ticket comments for the validation report.

### Not in this ticket

- Production-scale load tests; tuning beyond the targets.

## Acceptance checks

- [x] **AC-34** (NFR-01). k6 submits 1 MB Reports at 10 requests/s for 60 s on the laptop setup; p95 acknowledgement time is < 300 ms, and there are 0 non-2xx responses.
- [x] **AC-35** (NFR-02). A Report with 1,000 test cases reaches `processed` in < 5 s, p95 over 20 submissions.
- [x] **AC-36** (NFR-03, A10). With 10,000 Tests and 200,000 Outcomes seeded in one Project, p95 for the Flaky Tests list, Test search and Test detail is < 500 ms over 100 requests each.

**How to verify by hand:**

- `npm run perf:load` (k6 via Docker), `npm run perf:processing`, `npm run perf:reads`; each prints p95 against its target.

## Tests expected

- **Load and performance:** the three scripts above, with thresholds that fail the run when a target is missed.
- **Integration:** if the fallback is built, the existing Flake ACs (AC-19 to AC-25) must stay green unchanged.

## Design notes

- Design §2 (k6 justified by NFR-01), §6 (computed on read and its fallback), §11 (k6 on demand only), §12 (first bottleneck).

## Definition of done

- [x] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [x] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [x] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [x] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [x] README updated if setup, run or test commands changed.
- [x] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

Built: `load/k6-submit.js` + `load/run-k6.sh` (AC-34, via a `perf` Compose profile), `load/processing.mjs` (AC-35), `load/seed-reads.mjs` (AC-36, its own Testcontainers Postgres — never the Compose database). Measured: AC-34 p95 ≈ 79 ms, 0 non-2xx over 601 requests; AC-35 p95 ≈ 876 ms over 20 submissions; AC-36 p95 ≈ 116 ms (Flaky Tests), 22 ms (search), 7 ms (detail) over 100 requests each. All well inside target, so A10's on-read fallback (design §6) was not built.

Deviation found running AC-34: nginx's default `client_max_body_size` (1 MB) rejected the 1 MB Report with `413` before it reached the API — `web` is the Compose stack's only entry point, so this blocked NFR-01 from being measurable at all. Fixed in `apps/web/nginx.conf` (`client_max_body_size 10m`, matching the API's own limit); recorded in `docs/02-srs.md` v1.5 and `docs/03-design.md` §10.

Follow-up (out of scope here): A7 ("Reports stay well under 10 MB") is still open — nothing exercises the API's 10 MB raw-body ceiling itself.
