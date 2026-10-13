# Raw results

## vitest-normal

Runs: 20. Identity stable across all runs: **yes**.

| classname | name | file | stable | note |
|---|---|---|---|---|
| `fixtures/erroring.test.ts` | `report ingestion > throws while parsing a malformed report` | `` | yes |  |
| `fixtures/failing.test.ts` | `report ingestion > rejects a report with a bad checksum` | `` | yes |  |
| `fixtures/flaky.test.ts` | `report ingestion > duplicate detection > records two concurrent uploads in submission order` | `` | yes |  |
| `fixtures/passing.test.ts` | `report ingestion > accepts a well-formed report` | `` | yes |  |
| `fixtures/skipped.test.ts` | `report ingestion > re-processes a report after a rule change (not implemented yet)` | `` | yes |  |

Flaky test failure rate:

| classname | runs | fail rate | outcomes |
|---|---|---|---|
| `fixtures/flaky.test.ts [MacBook-Air-von-admin.local]` | 20 | 35% | pass, fail, pass, pass, pass, pass, pass, fail, pass, pass, pass, pass, fail, fail, pass, pass, fail, fail, fail, pass |

<details><summary>Raw testcase samples</summary>

**failure** (`fixtures/erroring.test.ts::report ingestion > throws while parsing a malformed report`):

```xml
<testcase classname="fixtures/erroring.test.ts" name="report ingestion &gt; throws while parsing a malformed report" time="0.002781208">
            <failure message="malformed report: unexpected end of XML" type="Error">
Error: malformed report: unexpected end of XML
 ❯ fixtures/erroring.test.ts:5:11
            </failure>
        </testcase>
```

**pass** (`fixtures/flaky.test.ts::report ingestion > duplicate detection > records two concurrent uploads in submission order`):

```xml
<testcase classname="fixtures/flaky.test.ts" name="report ingestion &gt; duplicate detection &gt; records two concurrent uploads in submission order" time="0.01593375">
        </testcase>
```

**skipped** (`fixtures/skipped.test.ts::report ingestion > re-processes a report after a rule change (not implemented yet)`):

```xml
<testcase classname="fixtures/skipped.test.ts" name="report ingestion &gt; re-processes a report after a rule change (not implemented yet)" time="0">
            <skipped/>
        </testcase>
```

</details>

## vitest-retry

Runs: 20. Identity stable across all runs: **yes**.

| classname | name | file | stable | note |
|---|---|---|---|---|
| `fixtures/erroring.test.ts` | `report ingestion > throws while parsing a malformed report` | `` | yes |  |
| `fixtures/failing.test.ts` | `report ingestion > rejects a report with a bad checksum` | `` | yes |  |
| `fixtures/flaky.test.ts` | `report ingestion > duplicate detection > records two concurrent uploads in submission order` | `` | yes |  |
| `fixtures/passing.test.ts` | `report ingestion > accepts a well-formed report` | `` | yes |  |
| `fixtures/skipped.test.ts` | `report ingestion > re-processes a report after a rule change (not implemented yet)` | `` | yes |  |

Flaky test failure rate:

| classname | runs | fail rate | outcomes |
|---|---|---|---|
| `fixtures/flaky.test.ts [MacBook-Air-von-admin.local]` | 20 | 10% | pass, pass, pass, pass, pass, fail, pass, pass, fail, pass, pass, pass, pass, pass, pass, pass, pass, pass, pass, pass |

<details><summary>Raw testcase samples</summary>

**failure** (`fixtures/erroring.test.ts::report ingestion > throws while parsing a malformed report`):

```xml
<testcase classname="fixtures/erroring.test.ts" name="report ingestion &gt; throws while parsing a malformed report" time="0.00338725">
            <failure message="malformed report: unexpected end of XML" type="Error">
Error: malformed report: unexpected end of XML
 ❯ fixtures/erroring.test.ts:5:11
            </failure>
            <failure message="malformed report: unexpected end of XML" type="Error">
Error: malformed report: unexpected end of XML
 ❯ fixtures/erroring.test.ts:5:11
            </failure>
            <failure message="malformed report: unexpected end of XML" type="Error">
Error: malformed report: unexpected end of XML
 ❯ fixtures/erroring.test.ts:5:11
            </failure>
        </testcase>
```

**pass** (`fixtures/flaky.test.ts::report ingestion > duplicate detection > records two concurrent uploads in submission order`):

```xml
<testcase classname="fixtures/flaky.test.ts" name="report ingestion &gt; duplicate detection &gt; records two concurrent uploads in submission order" time="0.035472292">
        </testcase>
```

**skipped** (`fixtures/skipped.test.ts::report ingestion > re-processes a report after a rule change (not implemented yet)`):

```xml
<testcase classname="fixtures/skipped.test.ts" name="report ingestion &gt; re-processes a report after a rule change (not implemented yet)" time="0">
            <skipped/>
        </testcase>
```

</details>

## playwright-normal

Runs: 20. Identity stable across all runs: **yes**.

| classname | name | file | stable | note |
|---|---|---|---|---|
| `erroring.spec.ts` | `report ingestion › throws while parsing a malformed report` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |
| `failing.spec.ts` | `report ingestion › rejects a report with a bad checksum` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |
| `flaky.spec.ts` | `report ingestion › duplicate detection › records two concurrent uploads in submission order` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |
| `passing.spec.ts` | `report ingestion › accepts a well-formed report` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |
| `skipped.spec.ts` | `report ingestion › re-processes a report after a rule change (not implemented yet)` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |

Flaky test failure rate:

| classname | runs | fail rate | outcomes |
|---|---|---|---|
| `flaky.spec.ts [chromium]` | 20 | 40% | fail, fail, pass, pass, pass, pass, fail, fail, pass, pass, pass, fail, fail, pass, pass, pass, pass, pass, fail, fail |
| `flaky.spec.ts [firefox]` | 20 | 50% | fail, fail, pass, fail, pass, pass, pass, pass, fail, pass, fail, fail, pass, pass, fail, pass, pass, fail, fail, fail |

<details><summary>Raw testcase samples</summary>

**error** (`erroring.spec.ts::report ingestion › throws while parsing a malformed report`):

```xml
<testcase name="report ingestion › throws while parsing a malformed report" classname="erroring.spec.ts" time="0.001">
<system-err>
<![CDATA[
Warning: attachment ../../../test-results/erroring-report-ingestion--5f62c--parsing-a-malformed-report-chromium/error-context.md is missing]]>
</system-err>
<error message="malformed report: unexpected end of XML" type="Error">
<![CDATA[  [chromium] › erroring.spec.ts:4:7 › report ingestion › throws while parsing a malformed report ───

    Error: malformed report: unexpected end of XML

      3 | test.describe("report ingestion", () => {
      4 |   test("throws while parsing a malformed report", () => {
    > 5 |     throw new Error("malformed report: unexpected end of XML");
        |           ^
      6 |   });
      7 | });
      8 |
        at /Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/playwright/tests/erroring.spec.ts:5:11

    Error Context: ../../test-results/erroring-report-ingestion--5f62c--parsing-a-malformed-report-chromium/error-context.md
]]>
</error>
</testcase>
```

**failure** (`failing.spec.ts::report ingestion › rejects a report with a bad checksum`):

```xml
<testcase name="report ingestion › rejects a report with a bad checksum" classname="failing.spec.ts" time="0.006">
<system-err>
<![CDATA[
Warning: attachment ../../../test-results/failing-report-ingestion-r-c795e--report-with-a-bad-checksum-chromium/error-context.md is missing]]>
</system-err>
<failure message="expect(received).toBe(expected) // Object.is equality" type="expect.toBe">
<![CDATA[  [chromium] › failing.spec.ts:4:7 › report ingestion › rejects a report with a bad checksum ───────

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 5
    Received: 4

      3 | test.describe("report ingestion", () => {
      4 |   test("rejects a report with a bad checksum", () => {
    > 5 |     expect(2 + 2).toBe(5);
        |                   ^
      6 |   });
      7 | });
      8 |
        at /Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/playwright/tests/failing.spec.ts:5:19

    Error Context: ../../test-results/failing-report-ingestion-r-c795e--report-with-a-bad-checksum-chromium/error-context.md
]]>
</failure>
</testcase>
```

**pass** (`passing.spec.ts::report ingestion › accepts a well-formed report`):

```xml
<testcase name="report ingestion › accepts a well-formed report" classname="passing.spec.ts" time="0.011">
</testcase>
```

**skipped** (`skipped.spec.ts::report ingestion › re-processes a report after a rule change (not implemented yet)`):

```xml
<testcase name="report ingestion › re-processes a report after a rule change (not implemented yet)" classname="skipped.spec.ts">
<properties>
<property name="skip" value="">
</property>
</properties>
<skipped>
</skipped>
</testcase>
```

</details>

## playwright-retry

Runs: 20. Identity stable across all runs: **yes**.

| classname | name | file | stable | note |
|---|---|---|---|---|
| `erroring.spec.ts` | `report ingestion › throws while parsing a malformed report` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |
| `failing.spec.ts` | `report ingestion › rejects a report with a bad checksum` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |
| `flaky.spec.ts` | `report ingestion › duplicate detection › records two concurrent uploads in submission order` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |
| `passing.spec.ts` | `report ingestion › accepts a well-formed report` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |
| `skipped.spec.ts` | `report ingestion › re-processes a report after a rule change (not implemented yet)` | `` | yes | 2x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity) |

Flaky test failure rate:

| classname | runs | fail rate | outcomes |
|---|---|---|---|
| `flaky.spec.ts [chromium]` | 20 | 20% | pass, pass, pass, pass, pass, pass, pass, pass, fail, pass, pass, pass, pass, pass, fail, pass, fail, pass, fail, pass |
| `flaky.spec.ts [firefox]` | 20 | 15% | pass, fail, pass, pass, pass, pass, pass, pass, pass, pass, pass, fail, pass, pass, pass, pass, pass, pass, fail, pass |

<details><summary>Raw testcase samples</summary>

**error** (`erroring.spec.ts::report ingestion › throws while parsing a malformed report`):

```xml
<testcase name="report ingestion › throws while parsing a malformed report" classname="erroring.spec.ts" time="0.007">
<system-out>
<![CDATA[
[[ATTACHMENT|../../../test-results/erroring-report-ingestion--5f62c--parsing-a-malformed-report-chromium/error-context.md]]

[[ATTACHMENT|../../../test-results/erroring-report-ingestion--5f62c--parsing-a-malformed-report-chromium-retry1/error-context.md]]

[[ATTACHMENT|../../../test-results/erroring-report-ingestion--5f62c--parsing-a-malformed-report-chromium-retry2/error-context.md]]
]]>
</system-out>
<error message="malformed report: unexpected end of XML" type="Error">
<![CDATA[  [chromium] › erroring.spec.ts:4:7 › report ingestion › throws while parsing a malformed report ───

    Error: malformed report: unexpected end of XML

      3 | test.describe("report ingestion", () => {
      4 |   test("throws while parsing a malformed report", () => {
    > 5 |     throw new Error("malformed report: unexpected end of XML");
        |           ^
      6 |   });
      7 | });
      8 |
        at /Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/playwright/tests/erroring.spec.ts:5:11

    Error Context: ../../test-results/erroring-report-ingestion--5f62c--parsing-a-malformed-report-chromium/error-context.md

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: malformed report: unexpected end of XML

      3 | test.describe("report ingestion", () => {
      4 |   test("throws while parsing a malformed report", () => {
    > 5 |     throw new Error("malformed report: unexpected end of XML");
        |           ^
      6 |   });
      7 | });
      8 |
        at /Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/playwright/tests/erroring.spec.ts:5:11

    Error Context: ../../test-results/erroring-report-ingestion--5f62c--parsing-a-malformed-report-chromium-retry1/error-context.md

    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────

    Error: malformed report: unexpected end of XML

      3 | test.describe("report ingestion", () => {
      4 |   test("throws while parsing a malformed report", () => {
    > 5 |     throw new Error("malformed report: unexpected end of XML");
        |           ^
      6 |   });
      7 | });
      8 |
        at /Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/playwright/tests/erroring.spec.ts:5:11

    Error Context: ../../test-results/erroring-report-ingestion--5f62c--parsing-a-malformed-report-chromium-retry2/error-context.md
]]>
</error>
</testcase>
```

**failure** (`failing.spec.ts::report ingestion › rejects a report with a bad checksum`):

```xml
<testcase name="report ingestion › rejects a report with a bad checksum" classname="failing.spec.ts" time="0.02">
<system-out>
<![CDATA[
[[ATTACHMENT|../../../test-results/failing-report-ingestion-r-c795e--report-with-a-bad-checksum-chromium/error-context.md]]

[[ATTACHMENT|../../../test-results/failing-report-ingestion-r-c795e--report-with-a-bad-checksum-chromium-retry1/error-context.md]]

[[ATTACHMENT|../../../test-results/failing-report-ingestion-r-c795e--report-with-a-bad-checksum-chromium-retry2/error-context.md]]
]]>
</system-out>
<failure message="expect(received).toBe(expected) // Object.is equality" type="expect.toBe">
<![CDATA[  [chromium] › failing.spec.ts:4:7 › report ingestion › rejects a report with a bad checksum ───────

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 5
    Received: 4

      3 | test.describe("report ingestion", () => {
      4 |   test("rejects a report with a bad checksum", () => {
    > 5 |     expect(2 + 2).toBe(5);
        |                   ^
      6 |   });
      7 | });
      8 |
        at /Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/playwright/tests/failing.spec.ts:5:19

    Error Context: ../../test-results/failing-report-ingestion-r-c795e--report-with-a-bad-checksum-chromium/error-context.md

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 5
    Received: 4

      3 | test.describe("report ingestion", () => {
      4 |   test("rejects a report with a bad checksum", () => {
    > 5 |     expect(2 + 2).toBe(5);
        |                   ^
      6 |   });
      7 | });
      8 |
        at /Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/playwright/tests/failing.spec.ts:5:19

    Error Context: ../../test-results/failing-report-ingestion-r-c795e--report-with-a-bad-checksum-chromium-retry1/error-context.md

    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 5
    Received: 4

      3 | test.describe("report ingestion", () => {
      4 |   test("rejects a report with a bad checksum", () => {
    > 5 |     expect(2 + 2).toBe(5);
        |                   ^
      6 |   });
      7 | });
      8 |
        at /Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/playwright/tests/failing.spec.ts:5:19

    Error Context: ../../test-results/failing-report-ingestion-r-c795e--report-with-a-bad-checksum-chromium-retry2/error-context.md
]]>
</failure>
</testcase>
```

**pass** (`flaky.spec.ts::report ingestion › duplicate detection › records two concurrent uploads in submission order`):

```xml
<testcase name="report ingestion › duplicate detection › records two concurrent uploads in submission order" classname="flaky.spec.ts" time="0.015">
</testcase>
```

**skipped** (`skipped.spec.ts::report ingestion › re-processes a report after a rule change (not implemented yet)`):

```xml
<testcase name="report ingestion › re-processes a report after a rule change (not implemented yet)" classname="skipped.spec.ts">
<properties>
<property name="skip" value="">
</property>
</properties>
<skipped>
</skipped>
</testcase>
```

</details>

## jest-normal

Runs: 20. Identity stable across all runs: **yes**.

| classname | name | file | stable | note |
|---|---|---|---|---|
| `report ingestion throws while parsing a malformed report` | `report ingestion throws while parsing a malformed report` | `` | yes |  |
| `report ingestion rejects a report with a bad checksum` | `report ingestion rejects a report with a bad checksum` | `` | yes |  |
| `report ingestion re-processes a report after a rule change (not implemented yet)` | `report ingestion re-processes a report after a rule change (not implemented yet)` | `` | yes |  |
| `report ingestion duplicate detection records two concurrent uploads in submission order` | `report ingestion duplicate detection records two concurrent uploads in submission order` | `` | yes |  |
| `report ingestion accepts a well-formed report` | `report ingestion accepts a well-formed report` | `` | yes |  |

Flaky test failure rate:

| classname | runs | fail rate | outcomes |
|---|---|---|---|
| `report ingestion duplicate detection records two concurrent uploads in submission order` | 20 | 55% | fail, fail, pass, fail, pass, fail, fail, fail, pass, pass, pass, fail, pass, pass, pass, fail, fail, pass, fail, fail |

<details><summary>Raw testcase samples</summary>

**failure** (`report ingestion throws while parsing a malformed report::report ingestion throws while parsing a malformed report`):

```xml
<testcase classname="report ingestion throws while parsing a malformed report" name="report ingestion throws while parsing a malformed report" time="0.002">
      <failure>Error: malformed report: unexpected end of XML
    at Object.&lt;anonymous&gt; (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/jest/fixtures/erroring.test.ts:3:11)
    at Promise.finally.completed (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:1834:28)
    at new Promise (&lt;anonymous&gt;)
    at callAsyncCircusFn (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:1774:10)
    at _callCircusTest (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:1167:40)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
    at _runTestInContext (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:1103:3)
    at runTestWithContext (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:996:5)
    at _runTestsForDescribeBlockOnce (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:1008:11)
    at _runTestsForDescribeBlock (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:824:5)
    at _runTestsForDescribeBlockOnce (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:1003:11)
    at _runTestsForDescribeBlock (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:824:5)
    at run (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:789:3)
    at runAndTransformResultsToJestFormat (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/jestAdapterInit.js:2300:21)
    at jestAdapter (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-circus/build/runner.js:111:19)
    at runTestInternal (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-runner/build/index.js:247:16)
    at runTest (/Users/admin/TEST_TASKS/tech-assignment/prototypes/reporter-output-and-flakiness/node_modules/jest-runner/build/index.js:315:7)</failure>
    </testcase>
```

**skipped** (`report ingestion re-processes a report after a rule change (not implemented yet)::report ingestion re-processes a report after a rule change (not implemented yet)`):

```xml
<testcase classname="report ingestion re-processes a report after a rule change (not implemented yet)" name="report ingestion re-processes a report after a rule change (not implemented yet)" time="0">
      <skipped/>
    </testcase>
```

**pass** (`report ingestion accepts a well-formed report::report ingestion accepts a well-formed report`):

```xml
<testcase classname="report ingestion accepts a well-formed report" name="report ingestion accepts a well-formed report" time="0">
    </testcase>
```

</details>
