# 12 — Performance verification

Status: ready-for-agent
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

- [ ] **AC-34** (NFR-01). k6 submits 1 MB Reports at 10 requests/s for 60 s on the laptop setup; p95 acknowledgement time is < 300 ms, and there are 0 non-2xx responses.
- [ ] **AC-35** (NFR-02). A Report with 1,000 test cases reaches `processed` in < 5 s, p95 over 20 submissions.
- [ ] **AC-36** (NFR-03, A10). With 10,000 Tests and 200,000 Outcomes seeded in one Project, p95 for the Flaky Tests list, Test search and Test detail is < 500 ms over 100 requests each.

**How to verify by hand:**

- `npm run perf:load` (k6 via Docker), `npm run perf:processing`, `npm run perf:reads`; each prints p95 against its target.

## Tests expected

- **Load and performance:** the three scripts above, with thresholds that fail the run when a target is missed.
- **Integration:** if the fallback is built, the existing Flake ACs (AC-19 to AC-25) must stay green unchanged.

## Design notes

- Design §2 (k6 justified by NFR-01), §6 (computed on read and its fallback), §11 (k6 on demand only), §12 (first bottleneck).

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments
