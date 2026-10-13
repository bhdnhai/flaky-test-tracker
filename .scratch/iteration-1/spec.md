Status: ready-for-agent

# Spec: Flaky Test Tracker, iteration 1

Requirements baseline: [docs/02-srs.md](../../docs/02-srs.md) (v1.0). FR, NFR and AC IDs below refer to it. Glossary: [CONTEXT.md](../../CONTEXT.md). Decisions: [docs/adr/](../../docs/adr/).

## Problem Statement

When CI goes red, an Engineer can't tell whether their change broke a test or the test fails randomly. GitHub Actions shows one run at a time, and runner retries hide flakiness. So the team clicks "Re-run failed jobs" until it's green, the knowledge stays in people's heads, and nobody knows which flaky tests cost the most. Hosted products that solve this require sending test output to a third party and pricing per seat. The full problem, users and value are in [docs/01-problem-definition.md](../../docs/01-problem-definition.md).

## Solution

A self-hosted service that the CI Pipeline sends JUnit XML Reports to after every test job, tagged with the Commit SHA. It keeps each raw Report, processes it in the background into Outcomes per Test, and detects Flakes: a Test that both passed and failed on the same Commit. A read-only dashboard lets an Engineer search for the failing Test and see a verdict with evidence ("Flaky: N Flakes", or "No Flakes recorded"), and lets a Tech Lead see Flaky Tests ranked by how often they flaked recently. An Operator manages Projects and Upload Tokens through a CLI. A demo runs a genuinely flaky test suite on the reviewer's machine and submits its real Reports through the same endpoint CI uses.

## User Stories

### Operator
1. As an Operator, I want to create a Project from the CLI, so that a repository's Reports are kept separate from other repositories'.
2. As an Operator, I want the Upload Token printed once at creation, so that I can put it in a CI secret without it being retrievable later.
3. As an Operator, I want only a hash of the token stored, so that a database leak doesn't expose working tokens.
4. As an Operator, I want to rotate a Project's Upload Token, so that a leaked token stops working immediately.
5. As an Operator, I want invalid or duplicate Project names rejected with a clear message and a non-zero exit code, so that scripts and humans notice mistakes.
6. As an Operator, I want a Reports page showing each Report's processing state, so that I can confirm CI data is arriving and being processed.
7. As an Operator, I want failed Reports to show their error, so that I can tell a broken reporter configuration from a system problem.
8. As an Operator, I want a Collision warning on a Report that names the reporter option to fix it, so that I can correct the CI configuration instead of trusting incomplete data.
9. As an Operator, I want to change the ranking window in configuration, so that teams with slower or faster release cycles see a meaningful ranking.
10. As an Operator, I want to reprocess a Report, so that a Report that failed because of a since-fixed bug can still count.
11. As an Operator, I want a health endpoint, so that I can tell whether the service can reach its database.
12. As an Operator, I want structured logs with a request ID, so that I can trace one submission through to its processing.

### CI Pipeline
13. As a CI Pipeline, I want to submit a Report with one HTTP request using only GitHub's built-in variables and a secret, so that adding the tracker is a single workflow step.
14. As a CI Pipeline, I want submission to be acknowledged quickly and independently of processing, so that the tracker never slows down or fails my job.
15. As a CI Pipeline, I want a clear 4xx error with a stable code when my token, Commit or body is wrong, so that a misconfiguration fails loudly at setup time.
16. As a CI Pipeline, I want a resubmission of the same Report to succeed without creating a second Report, so that retrying the upload step is safe.
17. As a CI Pipeline, I want to attach branch, run ID, run attempt and job name, so that the evidence for a Flake shows which run it came from.
18. As a CI Pipeline, I want a token that only allows submitting to its own Project, so that a leaked secret can't read data or reach other Projects.

### Engineer
19. As an Engineer, I want to search for a Test by part of its name, so that I can go from a failing test name in a CI log to its history.
20. As an Engineer, I want search to find Tests that have never flaked too, so that "No Flakes recorded" tells me the failure is probably mine.
21. As an Engineer, I want the verdict to be the first thing on the Test detail page, so that I get my answer without reading the history.
22. As an Engineer, I want to see the Commits on which the Test both passed and failed, with the failure messages, so that I trust the verdict.
23. As an Engineer, I want each Outcome to show branch, run attempt and job, so that I can find the CI run it came from.
24. As an Engineer, I want reaching a verdict to take at most 2 clicks after typing the name, so that checking is faster than re-running.
25. As an Engineer, I want a test that fails consistently never to be called flaky, so that the tracker doesn't excuse real breakage.
26. As an Engineer, I want skipped results ignored, so that a skipped test isn't mistaken for flaky.
27. As an Engineer, I want test names and failure messages shown as plain text, so that content from a Report can't run code in my browser.
28. As an Engineer, I want the dashboard usable by keyboard and screen reader, so that everyone on the team can use it.

### Tech Lead
29. As a Tech Lead, I want Flaky Tests ranked by the number of Flakes in the recent window, so that the team fixes the tests that cost the most re-runs first.
30. As a Tech Lead, I want ties broken by the most recent Flake, so that currently active problems come first.
31. As a Tech Lead, I want a test that stopped flaking to drop out of the ranking after the window, so that the list reflects the current state.
32. As a Tech Lead, I want a Projects page, so that I can switch between the repositories my team owns.

### Reviewer (demo)
33. As a reviewer, I want to start the system and see real results in at most 3 commands and 5 minutes, so that I can evaluate it without cloud accounts.
34. As a reviewer, I want the demo to run genuinely flaky tests rather than replay recordings, so that what I see is evidence the system works.
35. As a reviewer, I want the demo to go through the same submission endpoint as CI, so that the demo proves the real integration path.
36. As a reviewer, I want to see this repository's own CI submitting Reports, so that the GitHub Actions integration is proven, not claimed.

## Implementation Decisions

- **Modules.** The units below are deliberately few and deep. Frameworks and the repository layout are decided in the design step.
  - **Report intake:** authentication, synchronous checks, duplicate detection, raw storage, enqueueing.
  - **Report processing:** claiming, retrying, expiring claims, state transitions.
  - **JUnit interpretation:** a pure domain module. Raw XML → test cases with identity, Outcome and failure message, plus the list of Collisions. No I/O.
  - **Flake analysis:** Outcomes → Flakes, the ranking, the verdict. Pure rules over data; queries live behind it.
  - **Read API:** Projects, Flaky Tests, Test search, Test detail, Reports.
  - **Operator CLI:** create-project, rotate-token, reprocess-report.
  - **Dashboard:** Projects, Flaky Tests with search, Test detail, Reports.
  - **Demo runner and fixture suite.**
- **API contract.** REST under `/api/v1`, one JSON error envelope `{error: {code, message, details?, requestId}}`. Submission is `POST /api/v1/reports` with the raw XML body, metadata in query parameters, and `Authorization: Bearer ftt_…`. `202` for a new Report, `200` with `duplicate: true` for a duplicate. Full endpoint table: SRS §9.
- **Data model.** Project, Report, Test, Outcome (SRS §7):
  - Uniqueness rules: Report on (Project, Commit, content hash); Test on (Project, `classname`, `name`); Outcome on (Report, Test).
  - Flake is derived, not stored.
  - Outcome carries the Commit, copied from its Report, so Flake detection groups without a join.
- **Report lifecycle.** `pending → processing → processed | failed`, with retry (3 attempts in total) and claim expiry (60 s) both returning to `pending`. Reprocessing (Could) returns `processed`/`failed` to `pending`. SRS §8 has the full transition table.
- **Test identity (ADR-0005).** `classname` + `name` exactly as reported. `<testsuite hostname>` is never read: Playwright puts the project name there and Vitest puts the machine hostname, so reading it would break identity across CI runners. When one Report contains the same `classname` + `name` more than once, those cases record no Outcome and the Report carries a Collision warning naming the fix.
- **Outcome mapping** (confirmed by the prototype for Vitest, Playwright and jest-junit):

  | In the JUnit XML | Outcome |
  |---|---|
  | `<failure>` or `<error>` child | failed (message attribute + text, truncated to 8 KB) |
  | `<skipped>` child | skipped |
  | neither | passed |

  Retries are not used as a signal: a test that passed on retry is indistinguishable from a plain pass in the XML.
- **XML handling.** DOCTYPE is rejected, DTDs and entities are never resolved, and the 10 MB cap is applied before parsing. A synchronous well-formedness and root-element check happens at intake; full interpretation happens in background processing.
- **Tokens.** `ftt_` prefix plus at least 256 random bits; only a SHA-256 hash is stored; the same `401` for every failure reason.
- **Ranking.** A Flake's time is the receipt time of the latest Report contributing to it. The ranking window defaults to 14 days and is configurable (1–90). Order: Flakes in the window (descending), most recent Flake time (descending), `name` (ascending).
- **Demo fixture technique** (from the prototype): a completion-order race. Two concurrent jobs each wait a random delay drawn from the same range and append their ID to a shared list; the test asserts a fixed order. By symmetry, either job finishes first with equal probability, so P(fail) ≈ 0.5 regardless of machine speed (measured 35–60% on an M1 laptop and with `--cpus=0.5`). The trimmed decision-rich core from the prototype:

  ```ts
  async function job(log: string[], id: string) {
    await wait(2 + Math.random() * 18); // same distribution for both jobs → symmetric race
    log.push(id);
  }
  // test: await Promise.all([job(log, "first"), job(log, "second")]); expect(log).toEqual(["first", "second"]);
  ```

  A naive lost-update race was rejected because it failed 65–100% of the time.

## Testing Decisions

- **What makes a good test here:** it exercises behaviour through a public interface, using real reporter XML, and asserts what a user or the CI Pipeline would observe (status codes, list contents, verdicts), never internal calls or table layouts. Test names carry the AC ID (for example "AC-19: …").
- **Seams, highest first:**
  1. **The HTTP API against a real PostgreSQL.** This is the primary seam: submit Reports → wait for processing → read the Flaky Tests list, search and Test detail. It covers most ACs (AC-04 … AC-26, AC-38).
  2. **The JUnit interpretation and Flake analysis domain modules.** Unit tests feed them the real XML samples captured by the prototype (Vitest, Playwright single and multi-project, jest-junit defaults, retries) and edge cases: truncation, Collisions, skipped. Target ≥ 90% line coverage (NFR-12).
  3. **The dashboard in a browser** (Playwright): the core workflow (AC-23, AC-25, AC-26), XSS rendering (AC-27), and axe-core accessibility with keyboard-only use (AC-37).
  4. **The Operator CLI through its command interface** (AC-01 … AC-03, AC-32).
  5. **Load and timing:** k6 for submission (AC-34); scripted measurements for processing and reads (AC-35, AC-36).
- **Reliability tests** stop or kill the worker around real submissions (AC-17, AC-18) rather than mocking the queue.
- **Prior art:** none in the application codebase yet. The prototype branch `prototype/reporter-output-and-flakiness` holds real XML samples and a harness that runs fixture suites repeatedly, which serve as the source for fixture data.

## Out of Scope

- User login, OIDC and RBAC; managing Projects from the dashboard; Organisations or multi-tenancy.
- A Run entity; tracking Tests across renames; statistical flakiness; using retries as a signal.
- Feedback inside CI (next iteration, first priority); trend charts; quarantining; notifications.
- Formats other than JUnit XML; retention or deletion.
- Rate limiting, pagination beyond the stated caps, worker scaling or an external message queue, metrics or tracing, HTTPS, backups, token expiry.

Reasons for each are in [docs/01-problem-definition.md](../../docs/01-problem-definition.md#non-goals-deliberately-not-in-iteration-1) and SRS §14.

## Further Notes

- **Open for the design step:** how GitHub-hosted runners reach an internal deployment (a public submission-only endpoint vs. self-hosted runners); where raw Report content is stored (database vs. file or object storage); whether Flakes are computed on read or materialised (A10, NFR-03).
- **Unverified assumptions carried into implementation:** A1, A3, A4 (checked by FR-34), A6, A7, A9, A10. Statuses are in SRS §13.
- **Updating the SRS:** if implementation proves a requirement wrong, update the SRS and its document history instead of diverging silently.
