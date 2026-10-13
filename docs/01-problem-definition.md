# Problem Definition: Flaky Test Tracker

Domain terms in **bold** are defined in [CONTEXT.md](../CONTEXT.md). Decisions are recorded in [docs/adr/](adr/).

## Problem

When a CI build goes red, the **Engineer** has to answer one question: *did my change break this, or is it a test that fails randomly?* CI tooling doesn't help answer it:

- GitHub Actions shows one run at a time. No view shows how a test behaved across previous runs of the same code.
- Retry settings (`retries` in Playwright and Jest) hide flakiness instead of exposing it. A test that passes on its third attempt reports as green.
- So the usual workaround is to **click "Re-run failed jobs" until it goes green**, and maybe ask in a chat channel whether anyone has seen this test fail before. The re-run wastes CI minutes and the Engineer's attention. The knowledge stays in people's heads, and nobody can tell which flaky tests cost the most.

The teams we target use GitHub Actions with:

| Test runner | Typical flakiness pattern |
|---|---|
| Playwright | UI timing issues, browser startup instability, shared test data |
| Jest / Vitest | Shared state, async race conditions, test-order dependencies |

Hosted products solve this (Datadog CI Visibility, BuildPulse, Trunk), but they mean sending test names, file paths and failure output to a third party, usually with per-seat or per-test pricing. There is room for a small **self-hosted** tool that answers the core question and nothing more.

## Users

| Actor | Need | Frequency |
|---|---|---|
| **Engineer** (primary) | "Is this red build my fault, or a known **Flaky Test**?" | Every red build; several times a week per person |
| **Tech Lead** | "Which **Flaky Tests** cost us the most, so we fix those first?" | Weekly or per sprint |
| **Operator** | Create **Projects**, issue and rotate **Upload Tokens** | Rarely |
| **CI Pipeline** (machine) | Submit a **Report** after each test job without slowing down or breaking the build | Every CI job |

The Engineer and the Tech Lead see the same data with the same permissions. They are personas, not roles, so iteration 1 has no RBAC (ADR-0002).

## Value

- **A verdict instead of a guess.** A failing test is shown with evidence: the **Commits** on which it both passed and failed (each one a **Flake**). The Engineer stops re-running blindly.
- **Wasted time made visible.** Each **Flake** is roughly one manual re-run. Ranking **Flaky Tests** by Flake count gives the Tech Lead a prioritised fix list based on a cost the team actually pays.
- **Data stays in-house.** It's self-hosted, with no per-seat cost and no test output leaving the organisation (ADR-0001).

## Core workflow (the vertical slice)

1. The **Operator** creates a **Project** with a CLI command and receives its **Upload Token** (shown once).
2. The **Operator** adds the token as a CI secret and adds one step to the workflow that submits the runner's JUnit XML output with the **Commit** SHA. (JUnit XML is the standard cross-language CI test-report format, not a Java dependency; Vitest and Playwright produce it natively, and Jest via `jest-junit`.)
3. After each test job, the **CI Pipeline** submits the **Report**. Cheap checks run synchronously, and an invalid submission is rejected with a clear error. A valid one is accepted at once (ADR-0003).
4. In the background, the **Report** is parsed into **Outcomes**, and **Flakes** are detected: the same **Test** with both passed and failed **Outcomes** on the same **Commit** (ADR-0004).
5. A build goes red. The Engineer clicks "Re-run failed jobs", which reruns the *same* Commit, so this workaround now produces evidence.
6. The Engineer opens the Project's **Flaky Tests** list, finds the failing **Test**, and opens its detail. They see its **Outcome** history grouped by **Commit**, with failure messages, and know whether it's flaky.

## Scope (iteration 1)

**Ingestion**
- Projects and Upload Tokens are managed only by the Operator through a CLI: create a Project, rotate its token. Only a hash of each token is stored.
- An endpoint for submitting Reports, authenticated with an Upload Token. The Report carries:
  - the Commit SHA (required);
  - branch, CI run ID, run attempt and job name (optional).
- Synchronous rejection (`4xx`) of:
  - a missing or invalid token;
  - a missing or malformed Commit SHA;
  - an empty or oversized body;
  - a body that isn't well-formed JUnit XML.
- Duplicate Reports (same content, same Project) are ignored.
- Raw Reports are stored unchanged and processed asynchronously. Each Report shows a processing state: pending, processed or failed, with the error.

**Analysis**
- A Test is identified by Project + JUnit `classname` + `name`, exactly as reported (ADR-0005).
- **Collisions** (the same `classname` + `name` twice in one Report) are excluded from Flake detection for that Report, and the Report shows a warning naming the reporter option that fixes them:
  - Playwright with several projects: `includeProjectInTestName: true`.
  - jest-junit: a `classNameTemplate` that includes `{filepath}`.
- How JUnit results become Outcomes:

  | In the JUnit XML | Outcome |
  |---|---|
  | A test with no failure, error or skipped marker | passed |
  | `failure` or `error` | failed (the failure message is kept) |
  | `skipped` | skipped (ignored by flakiness detection) |

  The prototype confirmed this mapping for all three reporters. Retries are **not** read as a signal (see A5).

- Flake detection per ADR-0004.

**Dashboard** (read-only, no login)
- **Flaky Tests** list per Project, ranked by Flake count in a recent window, with the most recent Flake breaking ties.
- **Test** detail: Outcome history grouped by Commit, with failure messages.
- **Reports** list per Project: received Reports with their processing state and any Collision warning, so you can confirm data is arriving and is usable.

**Validation and demo**
- A **genuinely flaky** fixture test suite in the repository (Vitest):
  - Flakiness comes from a **completion-order race**: two concurrent jobs, each with a random delay, and the test assumes a fixed finishing order. Because the two delays are drawn from the same distribution, either job finishes first with equal probability, so P(fail) ≈ 0.5 whatever the machine speed. The prototype measured 35–60% on both an M1 laptop and a `--cpus=0.5` container. A naive "lost update" race was tried and rejected because it failed 65–100% of the time.
  - One consistently broken test.
  - Nothing is scripted to fail on a given attempt. Even at the lowest measured rate (35%), the chance a flaky test shows only one Outcome over 10 runs is about 1.4%.
- `npm run demo` creates a demo Project, runs the fixture suite about 10 times on the current git Commit, and submits each real JUnit output through the same endpoint CI uses.
- Optional: `demo:playwright`, with Playwright fixtures for the UI-timing pattern. It needs browser installs.
- *Should:* this repository's own GitHub Actions workflow runs the fixture suite and submits to the API, started as a service container inside the job. Re-running the job produces a real Flake on a real `GITHUB_SHA`.

## Non-goals (deliberately not in iteration 1)

| # | Not doing | Why not now |
|---|---|---|
| 1 | Organisations, multi-tenancy | One deployment per organisation is enough to prove the value (ADR-0001) |
| 2 | User login, OIDC, RBAC | No action yet differs between people; we assume an internal network (ADR-0002) |
| 3 | A **Run** entity; tracking Tests across renames | The Commit alone is enough to detect Flakes; rename heuristics are guesswork |
| 4 | Statistical (failure-rate) flakiness | Confuses real regressions with flakiness (ADR-0004) |
| 5 | Feedback inside CI (PR comment, "known flaky" in the submission response) | **Next iteration, #1 priority**: it delivers the verdict where the Engineer already is. Needs the core rule proven first. |
| 6 | Trend charts | Decoration; the ranked list answers the question |
| 7 | Quarantining or muting Tests, auto-creating tickets | Acts on the verdict; needs permissions (re-opens RBAC) |
| 8 | Slack or email notifications | Push channels before the signal is trusted would be noise |
| 9 | Report formats other than JUnit XML | JUnit XML already covers the target runners |
| 10 | Retention or deletion policy | Raw Reports are kept forever in iteration 1; volume is small |
| 11 | Managing Projects from the dashboard | Keeps privileged actions off the no-login, network-facing UI |

## Assumptions

| # | Assumption | How we'd find out it's wrong | Status |
|---|---|---|---|
| A1 | Teams re-run failed jobs often enough to produce evidence on the same Commit. | Check how often `GITHUB_RUN_ATTEMPT > 1` appears in a real repository's history. | Open |
| A2 | Vitest, Playwright and jest-junit fill `classname`/`name` in a way that is stable across runs. | Run the fixture suite through the real reporters and compare identities across runs. | **Partially refuted** by the prototype. Stable across runs for all three reporters, but **not unique**: Playwright with several projects emits identical `classname` + `name` per browser, and jest-junit's default templates collide for tests with the same wording in different files. See ADR-0005. |
| A3 | Runner or environment differences on the same Commit are rare enough that counting them as flakiness doesn't mislead. | Look for Flakes that only happen between different jobs (by job name) rather than within one job. | Open |
| A4 | For `pull_request` workflows, a re-run keeps the same SHA, the test merge commit. | Re-run a PR workflow and compare `GITHUB_SHA` across attempts. | Open |
| A5 | Retries inside a runner (Playwright `retries`) are visible in its JUnit output. If not, only cross-run evidence counts. | Run the fixture suite with retries on and read the generated XML. | **Partially confirmed** by the prototype. Visible only when every attempt fails (Vitest repeats `<failure>`; Playwright labels `Retry #n` in the failure text). A test rescued by a retry looks like a plain pass. Retries are not used as a signal in iteration 1; only evidence across Reports counts. |
| A6 | An internal network is an acceptable security boundary for a no-login dashboard. | Ask target teams' security or ops. Failing that is the trigger to add OIDC (ADR-0002). | Open |
| A7 | Report sizes stay within a few MB. | Measure fixture output and extrapolate to a suite of about 5k tests. | Open |
| A8 | The fixture suite's flakiness (about 50%) holds on different machines, even though timing-based races depend on CPU speed. | Run the demo on a fast laptop, a slow container and GitHub Actions, and compare failure rates. | **Confirmed** by the prototype for the completion-order race: 35–60% on both an M1 laptop and a `--cpus=0.5` container, within binomial noise at n = 20. Not yet measured on GitHub Actions. |

## Open questions

These are answered in the SRS unless marked otherwise.

- How long is the ranking window (14 days?), and is it configurable?
- What is the size limit for a Report?
- Failure messages can contain secrets or personal data printed by tests. Do we store them as they are, truncate them, or redact them?
- When does a Flaky Test stop being flaky? A fixed test drops out of a time-windowed ranking on its own. An explicit "fixed" state is iteration 2.
- How does CI submit: a documented `curl` step, or a published GitHub Action? (Design decision.)

## Success criteria

Iteration 1 succeeds when:

1. **Correct verdicts.** On the fixture suite, after N runs on the same Commit, every deliberately flaky Test is listed, and the consistently broken Test is **never** listed.
2. **Fast answer.** Starting from a Test name seen in a red CI log, an Engineer reaches the verdict with evidence in at most 2 clicks.
3. **No harm to CI.** Submitting a Report is acknowledged quickly (target in the SRS non-functional requirements), and a processing failure never fails the CI job.
4. **Easy to run.** From a fresh clone, with only Docker and Node installed and no cloud accounts, a reviewer sees populated results from genuinely flaky tests in **≤ 3 commands and ≤ 5 minutes** (`docker compose up`, `npm run demo`, open the dashboard).
