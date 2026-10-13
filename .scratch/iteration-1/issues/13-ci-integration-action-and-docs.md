# 13 — CI integration: composite GitHub Action and setup docs

Status: resolved
Priority: must
Blocked by: 06

## Goal

A team adds the tracker to their GitHub Actions workflow with one `uses:` step and the documented reporter configuration for their runner.

## Requirements covered

FR-33. ACs: AC-30.

## Scope

### In

- `.github/actions/submit-report` composite action: inputs `url`, `token`, `file`; reads `GITHUB_SHA`, `GITHUB_REF_NAME`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `GITHUB_JOB`; runs `curl --fail-with-body`; never echoes the token.
- README "Connect your CI" section: the `uses:` snippet, the plain `curl` equivalent, and reporter configuration per runner: Vitest (default), Playwright (`includeProjectInTestName: true` with more than one project), jest-junit (`classNameTemplate` containing `{filepath}`).
- A note on reachability from GitHub-hosted runners (ADR-0002 addendum).

### Not in this ticket

- Running the action in this repository's own CI (14).
- Publishing to the Marketplace (non-goal).

## Acceptance checks

- [ ] **AC-30** (FR-33). **Given** the setup documentation, **when** its GitHub Actions step and reporter configuration are copied into a workflow, **then** the step submits a Report successfully using only `GITHUB_*` variables and the token secret.

**How to verify by hand:**

- Run the action locally with `act`, or copy the `curl` equivalent with the same env vars against the Compose stack: the Report appears with branch, run ID, attempt and job filled in.

## Tests expected

- **Integration:** a shell test runs the action's script with fixed `GITHUB_*` env vars against the Compose stack (or a stub server) and asserts the request (AC-30).
- **E2E:** none (14 proves it on real GitHub).

## Design notes

- ADRs: 0002 (and its addendum), 0005 (reporter options). Design §11.

## Definition of done

- [ ] Every AC listed above has a passing test at the level named under "Tests expected", with the AC ID in the test name.
- [ ] `npm run lint`, `npm run typecheck`, unit and integration tests are green; E2E is green if this ticket touches the dashboard or the demo.
- [ ] `docs/02-srs.md` traceability matrix: test file(s) filled in for the ACs above.
- [ ] If implementation proved the SRS or design wrong or incomplete: `docs/02-srs.md` and/or `docs/03-design.md` updated, a line added to the SRS document history, and the discovery written under `## Comments` below.
- [ ] README updated if setup, run or test commands changed.
- [ ] One focused commit, Conventional Commits format, referencing this ticket (e.g. `feat(intake): … (#NN)`).

## Comments

Built `.github/actions/submit-report` (composite action, pure-bash `submit.sh`: percent-encodes
`GITHUB_*` metadata into the query string, `curl --fail-with-body`, never echoes the token) plus
the README "Connect your CI" section (uses: snippet, curl equivalent, reporter config per runner,
reachability note). AC-30 integration test uses a Node stub server, not Testcontainers/Compose —
it only needs to see what `submit.sh` sent — wired into `npm run test:integration` as
`test:ci-action`. No deviations from scope. Follow-up: ticket 14 runs this action for real inside
this repo's own CI (dogfood).
