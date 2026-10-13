# A Test is flaky when it both passed and failed on the same Commit

Status: accepted

## Context

What "flaky" means is the central rule of the product. Everything users see depends on it. A loose rule floods the list with real regressions, and a strict one misses the problem. Our targets are teams on GitHub Actions running Playwright (timing, browser startup, shared test data) and Jest/Vitest (shared state, async races, test-order dependencies).

## Considered options

- **Statistical: the failure rate on the main branch is above a threshold.** This needs no Commit data. But a real regression that is fixed a few Commits later looks exactly like flakiness, the threshold is arbitrary, and the answer changes with the window size.
- **Passed on retry within one run only.** This is a strong signal. But it depends on the runner having retries turned on and on the JUnit output showing each retry, which differs between reporters. It also misses the most common workaround: re-running the CI job by hand.
- **Mixed Outcomes on the same Commit, across any Reports.** (chosen) If the code didn't change and the Outcome did, the cause is outside the code under test.

## Decision

A **Flake** is a Commit on which a Test has at least one passed and at least one failed Outcome. A Test with at least one Flake is a **Flaky Test**. Skipped Outcomes don't count.

## Consequences

- Every Report must carry its Commit SHA. Without it a Report can't contribute to flakiness.
- Manual re-runs of CI jobs (the usual workaround) become the main source of signal at no extra cost. Retries within a run count too, if the JUnit output exposes them.
- A test that fails consistently on a Commit is never called flaky, which is correct: that's breakage.
- Differences between runners or environments on the same Commit are counted as flakiness. That's accepted, and recorded as an assumption.
- Because raw Reports are kept (ADR-0003), the rule can be refined later and re-applied to history.
