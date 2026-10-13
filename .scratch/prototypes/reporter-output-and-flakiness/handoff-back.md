# Handoff back: reporter output and flakiness — findings

Prototype branch: `prototype/reporter-output-and-flakiness` (commit `2da07f1`, never merged into
`main`). Full code, README, and raw XML evidence live there under
`prototypes/reporter-output-and-flakiness/` — this document summarises the findings and the
decisions they imply; see that branch for the complete per-reporter dumps
(`sample-results/host/summary.md`, `sample-results/docker/summary.md`) and the exact commands used.

## Original question

> How do real JUnit XML reporters (Vitest built-in, Playwright built-in, Jest via `jest-junit`)
> identify tests and represent failures, errors, skips and retries? And can a deliberately flaky
> test be tuned to fail about 50% of the time, reliably, across machines?

(Full brief: [`handoff-out.md`](handoff-out.md) in this same directory.)

## Answer per assumption

### A2 — "Vitest, Playwright and jest-junit fill `classname`/`name` in a way that is stable across runs"

**Partially refuted.** `classname`+`name` *is* stable across 20 unchanged runs for all three
reporters (every identity row in both `sample-results/host/summary.md` and
`sample-results/docker/summary.md` reports "stable"). But stability across runs is not the same as
uniqueness within a run, and two concrete collisions were found:

- **Playwright + multiple projects.** A config with two projects (`chromium`, `firefox`) produced
  **byte-identical `classname`+`name` for both**, every run. Project identity lives only in
  `<testsuite hostname="chromium">`, never in the per-testcase attributes:
  ```xml
  <testsuite name="flaky.spec.ts" hostname="chromium" ...>
  <testcase name="report ingestion › duplicate detection › records two concurrent uploads in submission order" classname="flaky.spec.ts" .../>
  ```
  (identical `classname`/`name` repeats verbatim under `hostname="firefox"`).
- **jest-junit defaults.** Built two throwaway files, both `describe("widgets") > it("creates one")`:
  ```xml
  <testcase classname="widgets creates one" name="widgets creates one" .../>
  <testcase classname="widgets creates one" name="widgets creates one" .../>
  ```
  Byte-identical. jest-junit's default `classNameTemplate`/`titleTemplate` is just the ancestor
  `describe` titles joined by a plain space — no file path, no delimiter between nesting levels.

Nested `describe` separators also differ, for context (not a product concern by itself, since the
product treats `name` as opaque, but explains why the two reporters' strings look so different):
Vitest `" > "`, Playwright `" › "`, jest-junit `" "` (none).

### A5 — "Retries inside a runner are visible in its JUnit output"

**Partially confirmed.** Retries are visible, but only as unstructured evidence, and only when the
test's *final* outcome is still a failure:

- Vitest `--retry=2`, all attempts fail → one `<testcase>`, three sibling `<failure>` elements:
  ```xml
  <testcase classname="fixtures/flaky.test.ts" name="... records two concurrent uploads in submission order" time="0.056425167">
      <failure message="expected [ 'second', 'first' ] to deeply equal [ 'first', 'second' ]" type="AssertionError">...</failure>
      <failure message="expected [ 'second', 'first' ] to deeply equal [ 'first', 'second' ]" type="AssertionError">...</failure>
      <failure message="expected [ 'second', 'first' ] to deeply equal [ 'first', 'second' ]" type="AssertionError">...</failure>
  </testcase>
  ```
  Vitest, retry rescues it to a pass → single clean `<testcase>`, **no failure element, no retry
  marker**, only a ~3x longer cumulative `time` as the sole (unreliable) hint:
  ```xml
  <testcase classname="fixtures/flaky.test.ts" name="... records two concurrent uploads in submission order" time="0.062423625">
  </testcase>
  ```
- Playwright `--retries=2`, all attempts fail → one `<failure>`/`<error>` whose text body
  concatenates every attempt, explicitly labelled `Retry #1`, `Retry #2`. Rescued-to-pass → the
  `<failure>` disappears entirely; the only trace is a dangling `<system-out>` attachment reference
  left over from the failed attempt — an incidental artifact path, not a designed signal.
- Jest: no built-in retry mechanism, not probed.

**Implication**: a retry that rescues a test is **not reliably detectable from the XML**. A5's own
"if not" fallback (only cross-run evidence counts) is the one to build on — see decisions below.

### A8 — "The fixture suite's flakiness (~50%) holds on different machines"

**Confirmed.** 20 runs/variant, host = Apple M1 vs. `docker run --cpus=0.5` on `node:22-slim`:

| Variant | Host (20 runs) | Docker `--cpus=0.5` (20 runs) |
|---|---|---|
| Vitest, no retry | 35% | 35% |
| Vitest, `--retry=2` | 10% | 10% |
| Playwright [chromium], no retry | 40% | 40% |
| Playwright [firefox], no retry | 50% | 60% |
| Playwright [chromium], `--retries=2` | 20% | 5% |
| Playwright [firefox], `--retries=2` | 15% | 0% |
| Jest, no retry | 55% | 55% |

Every no-retry rate landed within 10 points of its host counterpart; every retry-variant gap is
within one standard deviation of binomial noise at n=20, p≈0.125 (SD≈4.1pp) — not evidence of
collapse under throttling. Commands run: `npm run demo -- --runs=20` (host) and
`npm run demo:docker -- 20` (Docker; `docker run --cpus=0.5`, deps installed fresh inside the
container since host `node_modules` has macOS-only native binaries that won't load in Linux).

The technique: two concurrent "jobs" each wait a random 2-20ms then append their id to a shared
array; the test asserts a fixed completion order. By symmetry of two i.i.d. racing delays,
P(fail) ≈ 50% regardless of the exact delay range — derived analytically and confirmed by a cheap
standalone simulation (200-300 trials/config) before it was wired into any fixture. No seed, no
attempt counter, no env var.

## Decisions for the real system

**Test identity.** "Project + `classname` + `name`, exactly as reported" (current scope doc) is
**not safe as-is** for Playwright multi-project configs: capture `<testsuite hostname="...">` and
fold it into the Test's identity when present (Vitest and Jest don't set a meaningful `hostname`,
so this is additive, not a breaking change to the other two reporters). jest-junit's defaults are a
latent risk for teams who submit Jest Reports (in scope per the Core workflow's "Jest via
jest-junit") — call this out in CI-setup docs: teams must configure `classNameTemplate`/
`titleTemplate` (e.g. include `{filepath}`) rather than rely on jest-junit's defaults, or accept
that identically-worded tests in different files will collide.

**Outcome mapping.** The existing table (`failure`/`error` → failed, `skipped` → skipped-ignored,
anything else → passed) is **confirmed as-is, no change needed** — it already generalises cleanly
across all three reporters' actual output (Vitest/jest-junit both only ever emit `<failure>`,
Playwright uses a genuinely separate `<error>` for thrown exceptions, but both map to the same
"failed" Outcome per ADR-0004, which is exactly what the current rule already does).

**Retries.** Don't build a "detect retry" code path into v1 parsing — the evidence is unstructured
and, critically, absent for the case that matters most (a retry rescuing a flaky test to green).
A5's documented fallback — treat retries as a bonus signal only when a test fails despite retries,
and otherwise rely purely on cross-Commit Outcome history — is the right call and needs no revision.

**Fixture design for `npm run demo`.** The order-dependency race (race for *completion order* of
two concurrent jobs, not a naive "lost update" race) is the technique to use for the real Vitest
demo fixture (and the optional Playwright variant, reusing the same logic) — it held ~50% on both a
fast host and a throttled container with no per-environment tuning. Keep `npm run demo` at **10
runs**, matching the problem definition's own math (p≈0.5 over 10 runs → ~0.2% chance a flaky Test
shows only one Outcome); our measured rates (35-60%) keep that risk low single digits at worst.

## What surprised us

- Playwright's project/browser fan-out produces **exactly duplicate** `classname`+`name` pairs —
  not a rare edge case, but guaranteed every time a config has more than one project. A2's framing
  ("stable across runs") didn't anticipate this; uniqueness-within-a-run turned out to be the real
  risk, not run-to-run drift.
- jest-junit's defaults collide on wording alone, with zero file-path or nesting information. Two
  unrelated test files with the same `describe`/`it` text are indistinguishable to the product
  as currently scoped.
- Neither reporter gives a structured "retried" signal, and the *one case the product most wants
  to see* — a flaky test rescued by a retry — is the one case where the evidence disappears
  almost entirely (just timing). This validates the product's decision (implicit in A5's own "if
  not" clause) to not depend on retry visibility.
- A naive "lost update" race (read, await, write, assert no update was lost) was tried first and
  rejected: it simulated at 65-100% failure regardless of tuning (the maths: full serialization is
  rare once delay ranges overlap, so collision is the common case, not a coin flip). Racing for
  *completion order* instead gives an exact 50/50 by symmetry, independent of the delay
  distribution's shape — a materially better and more portable technique for any future flaky
  fixture.

## docs/01-problem-definition.md assumptions: status

| # | Assumption | Status |
|---|---|---|
| A2 | `classname`/`name` stable across runs | Partially refuted — stable across runs, not unique across Playwright projects or across jest-junit's default-templated files |
| A5 | Runner retries visible in JUnit output | Partially confirmed — visible only for a failing final outcome, invisible for a retry-rescued pass |
| A8 | ~50% flakiness holds across machines | Confirmed — host and `--cpus=0.5` Docker rates agree within sampling noise |
| A1, A3, A4, A6, A7 | (re-run frequency, cross-job flakiness, PR-merge-commit SHA stability, internal-network security boundary, Report size) | Not addressed by this prototype — out of scope for this question |

## Suggested skills

- `/mattpocock-skills:domain-modeling` — if A2's refutation changes how `CONTEXT.md` defines
  **Test** identity, or warrants a new ADR on including reporter `hostname` in identity.
- `/mattpocock-skills:research` — only if jest-junit's `classNameTemplate`/`titleTemplate` options
  need deeper confirmation from its docs before writing the SRS parsing rules.

## Review note (added on review, 2026-10-13)

The **Test identity** recommendation above, "fold `<testsuite hostname>` into the Test's identity; Vitest and Jest don't set a meaningful `hostname`", is **wrong** and was not adopted.

The raw XML on the prototype branch shows that Vitest writes the **machine's hostname** into that attribute: `hostname="MacBook-Air-von-admin.local"` on the host and `hostname="8fe268cac16d"` in Docker. On GitHub-hosted runners that value changes from job to job, so including it would give every Vitest Test a new identity on every run, and no Flake would ever be found. The prototype missed this because all 20 host runs happened on the same machine, which also made the identity look "stable".

The two findings themselves stand: Playwright multi-project collisions and jest-junit default-template collisions. They are handled by [ADR-0005](../../../docs/adr/0005-test-identity-is-classname-and-name-with-collision-detection.md): identity stays `classname` + `name` as reported, uniqueness comes from the documented reporter options (`includeProjectInTestName`, `classNameTemplate` with `{filepath}`), and Collisions are detected and excluded rather than guessed.

Also checked on review: the identical host and Docker failure rates (35/35, 55/55, 40/40) are a coincidence, not copied data. The run-by-run pass/fail sequences in the two `summary.json` files differ.
