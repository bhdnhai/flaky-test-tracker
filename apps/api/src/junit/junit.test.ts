import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { interpret } from './junit.js';

function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf-8');
}

const FOUR_CASE_REPORT = `
<testsuites>
  <testsuite name="suite">
    <testcase classname="C" name="passes" />
    <testcase classname="C" name="fails">
      <failure message="boom">failure text</failure>
    </testcase>
    <testcase classname="C" name="errors">
      <error message="kaboom">error text</error>
    </testcase>
    <testcase classname="C" name="skips">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;

describe('interpret', () => {
  it('AC-11: a passing, a <failure>, an <error> and a <skipped> test case map to 4 Tests with passed, failed, failed and skipped Outcomes, both failed Outcomes carrying a failure message', () => {
    const { cases } = interpret(FOUR_CASE_REPORT);

    expect(cases).toHaveLength(4);
    const byName = new Map(cases.map((c) => [c.name, c]));
    const passes = byName.get('passes')!;
    const fails = byName.get('fails')!;
    const errors = byName.get('errors')!;
    const skips = byName.get('skips')!;

    expect(passes).toMatchObject({ classname: 'C', name: 'passes', result: 'passed' });
    expect(passes.failureMessage).toBeUndefined();

    expect(fails).toMatchObject({ classname: 'C', name: 'fails', result: 'failed' });
    expect(fails.failureMessage).toContain('boom');
    expect(fails.failureMessage).toContain('failure text');

    expect(errors).toMatchObject({ classname: 'C', name: 'errors', result: 'failed' });
    expect(errors.failureMessage).toContain('kaboom');
    expect(errors.failureMessage).toContain('error text');

    expect(skips).toMatchObject({ classname: 'C', name: 'skips', result: 'skipped' });
    expect(skips.failureMessage).toBeUndefined();
  });

  it('AC-12: truncates a 20 KB multi-byte UTF-8 failure message to ≤ 8 KB of valid UTF-8', () => {
    // "é" (U+00E9, 2 UTF-8 bytes) repeated well past the 8 KB truncation boundary.
    const longMessage = 'é'.repeat(10_000);
    const xml = `
<testsuites>
  <testsuite name="suite">
    <testcase classname="C" name="t">
      <failure message="${longMessage}">${longMessage}</failure>
    </testcase>
  </testsuite>
</testsuites>`;

    const { cases } = interpret(xml);

    const failureMessage = cases[0]!.failureMessage!;
    const bytes = Buffer.from(failureMessage, 'utf-8');
    expect(bytes.byteLength).toBeLessThanOrEqual(8 * 1024);
    // Round-tripping through utf-8 without replacement characters confirms no character
    // was cut in half.
    expect(bytes.toString('utf-8')).toBe(failureMessage);
    expect(failureMessage).not.toContain('�');
  });

  it('FR-14: a Report whose root is a single <testsuite> (no <testsuites> wrapper) is still interpreted', () => {
    const { cases } = interpret(
      '<testsuite name="x"><testcase classname="C" name="t" /></testsuite>',
    );

    expect(cases).toEqual([{ classname: 'C', name: 't', result: 'passed' }]);
  });

  it('FR-14, ADR-0005: identity is classname + name exactly as reported; a Vitest testsuite’s hostname (the machine name) is ignored', () => {
    const { cases } = interpret(fixture('vitest-normal-run-01.xml'));

    expect(cases).toHaveLength(5);
    expect(cases).toContainEqual(
      expect.objectContaining({
        classname: 'fixtures/passing.test.ts',
        name: 'report ingestion > accepts a well-formed report',
        result: 'passed',
      }),
    );
  });

  it('FR-15: a jest-junit Report’s <failure> test cases map to failed Outcomes with a message, and its one <skipped> case maps to skipped', () => {
    const { cases } = interpret(fixture('jest-normal-run-01.xml'));

    expect(cases).toHaveLength(5);
    const results = cases.map((c) => c.result).sort();
    expect(results).toEqual(['failed', 'failed', 'failed', 'passed', 'skipped']);
    expect(cases.filter((c) => c.result === 'failed').every((c) => c.failureMessage)).toBe(true);
  });

  it('FR-15: a Playwright Report’s <error> test cases map to failed Outcomes with a message', () => {
    // Reported with includeProjectInTestName (ADR-0005), so chromium and firefox get
    // distinct names and neither collides (AC-15).
    const { cases, collisions } = interpret(fixture('playwright-collision-fixed-run-01.xml'));

    expect(collisions).toEqual([]);
    expect(cases).toHaveLength(2);
    const failing = cases.find((c) => c.name.includes('firefox'))!;
    expect(failing.result).toBe('failed');
    expect(failing.failureMessage).toContain('expect(received).toBe(expected)');
  });

  it('AC-14: a Playwright Report with two projects and no includeProjectInTestName collides; the colliding identity is excluded from cases and reported, mentioning includeProjectInTestName, even though one project passed and the other failed', () => {
    const { cases, collisions } = interpret(fixture('playwright-collision-run-01.xml'));

    expect(cases).toEqual([]);
    expect(collisions).toEqual([
      { classname: 'flaky.spec.ts', name: 'report ingestion › is sometimes flaky' },
    ]);
  });

  it('AC-15: the same Playwright suite reported with includeProjectInTestName: true produces two distinct Tests and no collision', () => {
    const { cases, collisions } = interpret(fixture('playwright-collision-fixed-run-01.xml'));

    expect(collisions).toEqual([]);
    expect(cases.map((c) => c.name).sort()).toEqual([
      '[chromium] report ingestion › is sometimes flaky',
      '[firefox] report ingestion › is sometimes flaky',
    ]);
  });

  it('FR-17: jest-junit’s default classNameTemplate (no {filepath}) collides two same-named tests from different files, excluding both from cases', () => {
    const { cases, collisions } = interpret(fixture('jest-collision-default-run-01.xml'));

    expect(cases).toEqual([]);
    expect(collisions).toEqual([
      { classname: 'report ingestion is sometimes flaky', name: 'report ingestion is sometimes flaky' },
    ]);
  });

  it('FR-16: a Vitest retry that fails on every attempt keeps only the first <failure>’s message', () => {
    const { cases } = interpret(fixture('vitest-retry-run-01.xml'));

    const erroring = cases.find((c) => c.classname === 'fixtures/erroring.test.ts')!;
    expect(erroring.result).toBe('failed');
    // All three retries emit the same message here, but the rule is "first", not "any"/"joined".
    expect(erroring.failureMessage).toContain('malformed report: unexpected end of XML');
    // The stack-trace line appears once per sibling <failure>; exactly one means only the
    // first was kept, not all three concatenated.
    expect(erroring.failureMessage?.match(/erroring\.test\.ts:5:11/g)).toHaveLength(1);
  });

  it('FR-16: a Playwright retry’s single <error> element (text already covering every retry) is kept whole', () => {
    // One project only: cross-project duplication is covered separately by AC-14/AC-15
    // (ADR-0005); this fixture's chromium+firefox pair would otherwise collide and say
    // nothing about retry handling.
    const xml = `
<testsuites>
  <testsuite name="erroring.spec.ts" hostname="chromium">
    <testcase name="report ingestion › throws while parsing a malformed report" classname="erroring.spec.ts">
      <error message="malformed report: unexpected end of XML" type="Error">
first attempt

Retry #1 ───

retry 1

Retry #2 ───

retry 2
      </error>
    </testcase>
  </testsuite>
</testsuites>`;
    const { cases } = interpret(xml);

    const erroring = cases.find((c) => c.classname === 'erroring.spec.ts')!;
    expect(erroring.result).toBe('failed');
    expect(erroring.failureMessage).toContain('Retry #1');
    expect(erroring.failureMessage).toContain('Retry #2');
  });
});
