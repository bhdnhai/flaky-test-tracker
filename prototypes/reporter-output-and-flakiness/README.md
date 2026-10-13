# Prototype: reporter output and flakiness

**Status: THROWAWAY.** This code exists only to answer the question below. It lives on the
`prototype/reporter-output-and-flakiness` branch, is never merged into `main`, and is not part of
the product. See [`.scratch/prototypes/reporter-output-and-flakiness/handoff-out.md`](../../.scratch/prototypes/reporter-output-and-flakiness/handoff-out.md)
on `main` for the full brief this answers.

## The question

> How do real JUnit XML reporters (Vitest built-in, Playwright built-in, Jest via `jest-junit`)
> identify tests and represent failures, errors, skips and retries? And can a deliberately flaky
> test be tuned to fail about 50% of the time, reliably, across machines?

This matters for two assumptions behind the product's data model:

- **A2**: Test identity = Project + `classname` + `name`, exactly as reported, and that pair is
  stable across runs.
- **A5**: Runner-level retries (Playwright `retries`, Vitest `retry`) are visible in the JUnit
  output, not silently collapsed to the final result.
- **A8**: A test tuned to fail ~50% of the time keeps roughly that rate on a fast host *and* in a
  CPU-starved container.

## How to run it

```bash
cd prototypes/reporter-output-and-flakiness
npm install
npm run demo                 # default: 10 runs/variant, concurrency 4 — about 25-30s on an M1
npm run demo -- --runs=20 --concurrency=4   # more runs, still well under a minute on a fast host
```

This runs five suite variants (Vitest, Vitest+retry, Playwright, Playwright+retry, Jest) `N` times
each, keeps every JUnit XML file under `runs/host/<variant>/run-NN.xml`, and prints: per-reporter
identity tables, one annotated raw `<testcase>` sample per outcome kind, and the flaky test's
observed failure rate. It also writes `runs/host/summary.{json,md}`.

For the CPU-starved comparison:

```bash
# Docker Desktop must be running first.
npm run demo:docker                 # 20 runs/variant inside `docker run --cpus=0.5`
npm run demo:docker -- 20           # explicit run count (same default)
```

The Docker variant installs dependencies **inside** the container (a named volume caches
`node_modules` across invocations — host `node_modules` is never bind-mounted, since esbuild and
other native deps are platform-specific and a macOS build won't load in a Linux container).
Measured on the M1 host used for this prototype: **~15 minutes** for `--runs=20` (fresh `npm
install` + 100 sequential suite executions under a 0.5 CPU quota — concurrency is pinned to 1 here
so the CPU cap is actually the bottleneck, not worker contention). Later runs with the volume warm
skip the install but are still sequential, so budget most of that time regardless.

Results land under `runs/<host|docker>/`, which is gitignored (regenerate anytime by re-running
the commands above). A snapshot of one real run of each is committed under `sample-results/` for
reference — see `sample-results/host/summary.md` and `sample-results/docker/summary.md` for the
full per-reporter dumps this README summarizes.

## What the fixtures look like

Each runner gets five tiny tests under its own directory (`vitest/fixtures`, `playwright/tests`,
`jest/fixtures`): one passing, one failing assertion, one thrown exception, one `.skip`, and one
flaky test shared via `shared/race.ts`.

**The flaky test is a genuine race, not a scripted failure.** Two concurrent "jobs" each wait a
random 2-20ms, then append their id to a shared array; the test asserts a fixed completion order
(`["first", "second"]`). Because both jobs draw delays from the same distribution, which one
finishes first is a real coin flip decided by the JS engine's timer scheduling — **by symmetry,
P(fail) ≈ 50% regardless of the exact delay range**, which was confirmed by direct simulation
(200-300 trials per config, see commit history) before wiring it into the fixtures. There is no
seed, no attempt counter, no environment variable — rerunning the same code with no code change
gives a different outcome because real OS/engine timer jitter decides it.

Playwright is configured with two no-op "projects" (`chromium`, `firefox`, both `use: {}`) purely
to observe how project identity shows up in JUnit output — none of the fixtures touch the `page`
fixture, so no browser is ever launched, keeping Playwright as fast as the other two runners.

## Findings

### 1. Identity: `classname` / `name` / `file`, and what breaks A2

| Reporter | `classname` | `name` | nested `describe` separator | `file` attr? |
|---|---|---|---|---|
| Vitest | file path, e.g. `fixtures/flaky.test.ts` | full title path, e.g. `report ingestion > duplicate detection > records two concurrent uploads in submission order` | `" > "` | not emitted |
| Playwright | **spec file name only**, e.g. `flaky.spec.ts` — no directory, no project | full title path, e.g. `report ingestion › duplicate detection › records two concurrent uploads in submission order` | `" › "` | not emitted (file path only appears inside failure/error text) |
| jest-junit (defaults) | **describe-path text**, e.g. `report ingestion duplicate detection records two concurrent uploads in submission order` — identical to `name` | same as `classname` | `" "` (plain space, no delimiter) | not emitted |

All three were **stable across all 20 runs** for `classname`+`name` on unchanged fixtures (see
`sample-results/*/summary.md` identity tables — every row says "stable").

That said, two concrete ways `classname`+`name` can collide, found by direct observation, not
speculation:

- **Playwright + multiple projects.** With two no-op projects (`chromium`, `firefox`), every
  fixture produced classname="`<file>.spec.ts`" / name="`<title path>`" **twice per run, every
  run** — identical in both projects. Project identity lives *only* in the `<testsuite
  hostname="chromium">` attribute and inside human-readable failure/error text (`[chromium] ›
  ...`), never in `classname` or `name`. **A2 is refuted as written**: if a repo's Playwright
  config fans a test out across projects, "Project (repo) + classname + name" from the product's
  domain model does not disambiguate them — the two project runs of the same test are
  indistinguishable by that key. Whatever uses this data needs either `hostname` or to combine
  Report metadata with classname+name, which A2 as currently phrased does not account for.
- **jest-junit defaults.** `classNameTemplate`/`titleTemplate` default to the ancestor-`describe`
  titles joined by a space — **no file path, no separator between describe levels**. Confirmed by
  building two throwaway files with an identical `describe("widgets") > it("creates one")` body:
  both produced byte-identical `classname="widgets creates one" name="widgets creates one"`.
  Two unrelated test files that happen to share wording collide outright under jest-junit's
  defaults; this is a real risk for a `report ingestion`-style shared vocabulary used repo-wide
  (as ours is in these very fixtures — every file shares the "report ingestion" describe block,
  and only the differing test titles kept classnames apart here).

Quoted elements, one pass/fail/error/skip example each (full snippets in `sample-results/`):

Vitest — assertion failure and thrown exception both become `<failure>`, distinguished only by
`type`; Vitest's own suite-level `errors="0"` never increments:

```xml
<failure message="malformed report: unexpected end of XML" type="Error">
<failure message="expected 4 to be 5 // Object.is equality" type="AssertionError">
<skipped/>
```

Playwright — the only one of the three that puts assertion failures and thrown exceptions in
**different elements** (`<failure type="expect.toBe">` vs `<error type="Error">`), and the
suite-level `errors` count reflects it:

```xml
<error message="malformed report: unexpected end of XML" type="Error">
<failure message="expect(received).toBe(expected) // Object.is equality" type="expect.toBe">
<skipped/>
```

jest-junit — like Vitest, both failure kinds become a bare `<failure>` with no `type` attribute at
all, just a raw stack-trace string body; `errors` stays 0:

```xml
<failure>Error: malformed report: unexpected end of XML
    at Object.&lt;anonymous&gt; (.../jest/fixtures/erroring.test.ts:3:11)
    ...</failure>
```

### 2. Retries: visible, but only partially, and differently per runner

**Neither reporter adds a `retries`/`attempt` count attribute.** Both expose retries only by
accumulating content inside the *existing* `<testcase>`, and only when the final outcome is a
failure:

- **Vitest (`--retry=2`)**: one `<testcase>`, but **multiple `<failure>` sibling elements** — one
  per failed attempt — when every attempt fails. A run where the first attempt failed and a retry
  then passed produces a single clean passing `<testcase>` **indistinguishable from a first-try
  pass**, except that cumulative `time` is roughly double. No explicit marker at all for "passed
  after retry". Example (3 attempts, all failed):

  ```xml
  <testcase classname="fixtures/flaky.test.ts" name="... records two concurrent uploads in submission order" time="0.056425167">
      <failure message="expected [ 'second', 'first' ] to deeply equal [ 'first', 'second' ]" type="AssertionError">...</failure>
      <failure message="expected [ 'second', 'first' ] to deeply equal [ 'first', 'second' ]" type="AssertionError">...</failure>
      <failure message="expected [ 'second', 'first' ] to deeply equal [ 'first', 'second' ]" type="AssertionError">...</failure>
  </testcase>
  ```
  vs. a retry-then-pass run — `time` roughly 3-5x the no-retry baseline, otherwise unremarkable:
  ```xml
  <testcase classname="fixtures/flaky.test.ts" name="... records two concurrent uploads in submission order" time="0.062423625">
  </testcase>
  ```

- **Playwright (`--retries=2`)**: also one `<testcase>` per project. When all attempts fail, the
  single final `<failure>`/`<error>` element's text body is the concatenation of every attempt,
  explicitly labelled `Retry #1`, `Retry #2`. When a retry eventually passes, the `<failure>`
  disappears entirely, but a `<system-out>` referencing a stale `error-context.md` **attachment
  from the failed attempt** is left behind — the only trace, and it's incidental (an artifact path
  reference, not a retry-count field), not a designed signal:
  ```xml
  <failure message="expect(received).toEqual(expected) // deep equality" type="expect.toEqual">
    ... first attempt text ...
    Retry #1 ─────────────────────────────────────
    ... retry 1 text ...
    Retry #2 ─────────────────────────────────────
    ... retry 2 text ...
  </failure>
  ```
  vs. pass-after-retry:
  ```xml
  <testcase name="... records two concurrent uploads in submission order" classname="flaky.spec.ts" time="0.048">
  <system-out><![CDATA[
  [[ATTACHMENT|.../test-results/flaky-...-firefox/error-context.md]]
  ]]></system-out>
  </testcase>
  ```

- **Jest**: no built-in retry mechanism (as the handoff anticipated), so not probed here.

**A5 verdict: partially refuted.** The XML *does* show retry evidence when the test ultimately
fails (stacked `<failure>`s for Vitest, `Retry #N` text for Playwright) — but when a retry rescues
the test, both reporters produce a plain pass, and the only trace is incidental (timing, or a
dangling attachment reference), not a structured field a parser could rely on. A parsing rule that
wants "this Test was retried" as a first-class signal cannot get it reliably from either reporter's
default JUnit output for the passing case.

### 3. Failure rate of the flaky fixture (A8)

20 runs per variant, host = Apple M1 (see command above); Docker = `docker run --cpus=0.5`,
`node:22-slim`, same fixtures, same command, concurrency pinned to 1.

| Variant | Host, M1 (20 runs) | Docker `--cpus=0.5`, `node:22-slim` (20 runs) |
|---|---|---|
| Vitest, no retry | 35% | 35% |
| Vitest, `--retry=2` | 10% | 10% |
| Playwright [chromium], no retry | 40% | 40% |
| Playwright [firefox], no retry | 50% | 60% |
| Playwright [chromium], `--retries=2` | 20% | 5% |
| Playwright [firefox], `--retries=2` | 15% | 0% |
| Jest, no retry | 55% | 55% |

Full per-run outcome lists in `sample-results/host/summary.md` and `sample-results/docker/summary.md`.

Host, no-retry rates cluster around the 35-55% band we aimed for (average ≈45% across the three
runners' no-retry variants) — consistent with the symmetry argument, not a coincidence of tuning.
The retry variants drop to roughly `p³` as expected (0.5³ = 12.5%), confirming retries are doing
real work and that the single-attempt race is what's actually driving the number, not some other
accidental bias.

**Docker `--cpus=0.5` holds up**: every no-retry rate lands within 10 points of its host
counterpart (35→35%, 40→40%, 50→60%, 55→55%), and every retry rate is within one standard
deviation of the binomial noise expected at n=20, p≈0.125 (SD≈4.1pp) — the two 0%/5% retry
readings are exactly the kind of sampling noise you'd expect at 20 trials, not a sign the rate
collapsed under throttling. **A8 is not refuted here**: scaling CPU down 2x did not visibly bias
the race, consistent with the race depending on OS/engine timer-firing order (which stays
contested even when slow) rather than on absolute CPU throughput.

## Answer

1. **Identity (A2)**: `classname`+`name` is stable across unchanged runs for all three reporters.
   But it is **not** safely unique on its own: Playwright's per-project fan-out produces identical
   classname+name pairs across projects (project identity lives only in `hostname`, outside the
   per-testcase identity), and jest-junit's default templates collide whenever two files share
   `describe`/`it` wording, because neither file path nor any delimiter is included by default.
   The SRS data model needs a disambiguation path for both: at minimum, capture `hostname`
   (Playwright project) as part of identity when present, and flag that jest-junit needs explicit
   `classNameTemplate`/`titleTemplate` configuration (e.g. including `{filepath}`) to be safe —
   don't rely on its defaults.
2. **Retries (A5)**: visible, but only as unstructured evidence tied to a *failing* final outcome
   (stacked `<failure>` elements for Vitest, `Retry #N` text blocks for Playwright). A
   retry-then-pass leaves no structured trace in either reporter — a parser cannot reliably detect
   "this passed on retry" from the XML alone. Treat A5 as a bonus signal only for the failing case,
   not a general mechanism.
3. **Flakiness tuning (A8)**: a genuine order-dependency race (two concurrent jobs racing to append
   to a shared array, asserting a fixed order) gives ~50% failure by construction — this was
   derived analytically (symmetry of two i.i.d. racing delays), confirmed by a cheap standalone
   simulation before touching the real fixtures, and held up in the real fixture runs across all
   three runners (35-55% band, no per-runner tuning needed). It **also held up under
   `--cpus=0.5`** — every Docker rate landed within 10 points of its host counterpart, well inside
   sampling noise for n=20. A8 is confirmed, not refuted, by this prototype.

## Not probed

- `test.each` / parameterised tests (out of scope for the fixed five-test-per-runner suite; worth
  a follow-up if parameterised identity becomes a concern).
- Playwright worker-level parallelism beyond `workers: 1` (kept fixed to isolate the project-fanout
  question from unrelated scheduling nondeterminism).
- Timeout-based errors specifically (used a thrown exception for "erroring" in all three suites,
  per the handoff's "thrown exception / timeout — either is fine").

## Versions used

Recorded from `prototypes/reporter-output-and-flakiness/package.json` at the time this was run —
see that file for exact installed versions: Vitest 5.0.4, `@playwright/test` 1.64.0, Jest 30.5.2 +
`jest-junit` 17.0.0, Node v22.16.0, Docker 27.4.0.
