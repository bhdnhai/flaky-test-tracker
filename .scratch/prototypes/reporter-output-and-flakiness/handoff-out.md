# Handoff: reporter output and flakiness prototype

## Question

> How do real JUnit XML reporters (Vitest built-in, Playwright built-in, Jest via `jest-junit`) identify tests and represent failures, errors, skips and retries? And can a deliberately flaky test be tuned to fail about 50% of the time, reliably, across machines?

The answer decides the data model and parsing rules in the SRS, which comes next. It must be answered with **real reporter output**, not documentation alone.

## Assumptions under test

Taken from [docs/01-problem-definition.md](../../../docs/01-problem-definition.md#assumptions):

| # | Assumption | What would refute it |
|---|---|---|
| A2 | Vitest, Playwright and jest-junit fill `classname`/`name` in a way that is stable across runs. Test identity = Project + `classname` + `name`, exactly as reported. | Any attribute that changes between runs of unchanged code: durations, random IDs, retry suffixes, parameter values, worker indexes. Also: two different tests that end up with the same `classname` + `name`. |
| A5 | Retries inside a runner (Playwright `retries`, Vitest `retry`) are visible in the JUnit output. | The XML shows only the final result of a retried test, with no trace of the earlier failed attempt. |
| A8 | A timing-race, shared-state or order-dependency test tuned to p ≈ 0.5 keeps roughly that failure rate on a fast machine and in a CPU-limited container. | The failure rate drifts heavily (for example 50% on the host, 0% or 100% at `--cpus=0.5`). |

## Domain context

Use the terms defined in [CONTEXT.md](../../../CONTEXT.md) exactly: **Report**, **Commit**, **Test**, **Outcome**, **Flake**, **Flaky Test**.

Relevant decisions:
- [ADR-0003](../../../docs/adr/0003-asynchronous-report-processing-with-raw-retention.md): the raw Report is the source of truth. Parsing rules can change later and be re-applied to history, so the prototype only has to *observe* the formats, not settle every edge case forever.
- [ADR-0004](../../../docs/adr/0004-flakiness-means-mixed-outcomes-on-the-same-commit.md): a Test is flaky when it has mixed Outcomes on the same Commit. `failure` and `error` both count as failed, and `skipped` is ignored. Retries are a bonus signal *if* the XML exposes them (that is A5).

Why A8 matters: the reviewer demo (`npm run demo`) runs a **genuinely flaky** fixture suite about 10 times on one Commit and must reliably produce Flakes. Fixtures scripted to fail on a given attempt or through an environment variable were **explicitly rejected**, because that amounts to simulating the product working. See Scope → "Validation and demo" in the problem definition.

## Constraints

- Node + TypeScript. Use the current stable Vitest, Playwright (`@playwright/test`) and Jest + `jest-junit`. Record the exact versions used in the README.
- Must run locally. No GitHub and no cloud.
- Host: Apple M1, 8 cores, Node v22.16.0, npm 10.9.2, Docker 27.4.0. **When this handoff was written the Docker daemon was not running.** Start Docker Desktop before the `--cpus=0.5` runs.
- Work on branch `prototype/reporter-output-and-flakiness` created from `main`. Never merge it. Put code in `prototypes/reporter-output-and-flakiness/` on that branch.
- Throwaway code: no tests of the prototype itself, no persistence, hard-coded data is fine.

## What a good answer looks like

1. **Per reporter:** one real XML sample covering a passing, failing (assertion), erroring (thrown exception or timeout), skipped and retried test. Plus a table of the `classname`, `name` and `file` attributes and how failure, error, skipped and retry appear, quoting the XML elements.
2. **Identity stability:** confirmation that every test's `classname` + `name` is identical across 10 runs, or a list of what changed.
3. **Failure rates:** a table of the observed failure rate for each flaky fixture, over ≥ 20 runs on the host and ≥ 20 runs in `docker run --cpus=0.5`.
4. **Recommendation:** which technique produces "genuinely flaky but about 50%" fixtures that hold up in both environments, and how many demo runs give a high probability of at least one Flake per flaky Test.

## Things worth probing (not exhaustive)

- Nested `describe` blocks: what separator is used in `name` and `classname`?
- Playwright: are the project/browser name and file path part of `classname` or `name`? What happens with two projects (for example chromium and firefox)?
- Does Playwright's JUnit reporter distinguish a *flaky* result (passed on retry) from a plain pass?
- Vitest `retry`: are attempts visible at all?
- jest-junit: defaults for `classNameTemplate` and `titleTemplate`. Does a default produce unstable or colliding identities?
- `test.each` / parameterised tests: are the names stable and unique?
- Timeouts: do they appear as `failure` or `error`, per reporter?

## Out of scope

Any API, database, parser for the product, UI, or Flake detection logic. This prototype only observes reporter output and fixture behaviour.

## Deliverables

- A README on the prototype branch: the question, how to run it (exact commands and expected duration), raw results, and the answer.
- Afterwards, findings are written back to `.scratch/prototypes/reporter-output-and-flakiness/handoff-back.md` on `main`.

## Suggested skills

- `/mattpocock-skills:prototype`: building the throwaway program and walking the user through the results.
- `/mattpocock-skills:handoff`: writing `handoff-back.md` when done.
- `/mattpocock-skills:research`: only if a reporter's behaviour needs confirming from its official docs or source code, for example the jest-junit template options.

## Repository rules for the next session

- Stage files explicitly by path. Never stage `AGENTS.md`, `docs/agents/` or `docs/ai-usage/`. They are excluded locally and must stay out of history.
- End commit messages with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
