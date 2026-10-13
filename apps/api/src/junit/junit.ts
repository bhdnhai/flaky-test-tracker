import { XMLParser } from 'fast-xml-parser';

const MAX_FAILURE_MESSAGE_BYTES = 8 * 1024;

export type OutcomeResult = 'passed' | 'failed' | 'skipped';

export interface InterpretedTestCase {
  classname: string;
  name: string;
  result: OutcomeResult;
  failureMessage?: string;
}

/** A `classname` + `name` reported by more than one test case in the same Report (FR-17). */
export interface CollidingIdentity {
  classname: string;
  name: string;
}

export interface InterpretedReport {
  cases: InterpretedTestCase[];
  collisions: CollidingIdentity[];
}

// Predefined XML entities (&gt; etc.) must decode for identity to be "exactly as reported"
// (Vitest's `name` uses &gt; for its " > " describe separator) — see design correction in
// the ticket's Comments. fast-xml-parser 5's entity decoder has its own built-in expansion
// limits and an unsafe-value check, so this is safe without `processEntities: false`.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['testsuite', 'testcase', 'failure', 'error'].includes(name),
});

// The root is either a <testsuites> wrapper around one or more <testsuite>, or (an older,
// still-valid shape some tools emit) a single bare <testsuite>.
interface RawDocument {
  testsuites?: { testsuite?: RawTestSuite[] };
  testsuite?: RawTestSuite[];
}

interface RawTestSuite {
  testcase?: RawTestCase[];
}

interface RawTestCase {
  '@_classname': string;
  '@_name': string;
  failure?: RawFailure[];
  error?: RawFailure[];
  skipped?: unknown;
}

// A <failure>/<error> with no attributes (jest-junit's default) parses as a plain string;
// one with attributes (Vitest, Playwright) parses as an object with its text under #text.
type RawFailure = string | { '@_message'?: string; '#text'?: string };

/**
 * Raw JUnit XML → Tests' identity, Outcome and failure message (FR-14 … FR-16).
 * Pure, no I/O. `hostname` and every other attribute beyond classname/name are ignored
 * (FR-15, ADR-0005). A Collision — two or more test cases sharing one classname+name in
 * this Report — excludes every one of those cases from `cases`; its identity is reported
 * in `collisions` instead (FR-17, ADR-0005: detected, not guessed from the reporter).
 */
export function interpret(xml: string): InterpretedReport {
  const doc = parser.parse(xml) as RawDocument;
  const suites = doc.testsuites?.testsuite ?? doc.testsuite ?? [];
  const rawCases = suites.flatMap((suite) => suite.testcase ?? []);

  const byIdentity = new Map<string, RawTestCase[]>();
  for (const raw of rawCases) {
    const key = identityKeyOf(raw['@_classname'], raw['@_name']);
    const group = byIdentity.get(key);
    if (group) group.push(raw);
    else byIdentity.set(key, [raw]);
  }

  const cases: InterpretedTestCase[] = [];
  const collisions: CollidingIdentity[] = [];
  for (const group of byIdentity.values()) {
    const [first] = group;
    if (group.length > 1) {
      collisions.push({ classname: first!['@_classname'], name: first!['@_name'] });
    } else {
      cases.push(interpretTestCase(first!));
    }
  }

  return { cases, collisions };
}

function identityKeyOf(classname: string, name: string): string {
  return `${classname}\u0000${name}`;
}

function interpretTestCase(testcase: RawTestCase): InterpretedTestCase {
  const classname = testcase['@_classname'];
  const name = testcase['@_name'];

  const failed = testcase.failure?.[0] ?? testcase.error?.[0];
  if (failed) {
    return {
      classname,
      name,
      result: 'failed',
      failureMessage: truncateUtf8(failureMessageOf(failed), MAX_FAILURE_MESSAGE_BYTES),
    };
  }
  if (testcase.skipped !== undefined) {
    return { classname, name, result: 'skipped' };
  }
  return { classname, name, result: 'passed' };
}

function failureMessageOf(element: RawFailure): string {
  if (typeof element === 'string') return element.trim();
  return [element['@_message'], element['#text']?.toString().trim()].filter(Boolean).join('\n');
}

/** Cuts `message` to at most `maxBytes` UTF-8 bytes, never mid-character. */
function truncateUtf8(message: string, maxBytes: number): string {
  const buffer = Buffer.from(message, 'utf-8');
  if (buffer.byteLength <= maxBytes) return message;

  let end = maxBytes;
  while (end > 0 && (buffer[end]! & 0xc0) === 0x80) end--;
  return buffer.subarray(0, end).toString('utf-8');
}
