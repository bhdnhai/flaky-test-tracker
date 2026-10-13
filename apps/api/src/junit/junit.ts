import { XMLParser } from 'fast-xml-parser';

const MAX_FAILURE_MESSAGE_BYTES = 8 * 1024;

export type OutcomeResult = 'passed' | 'failed' | 'skipped';

export interface InterpretedTestCase {
  classname: string;
  name: string;
  result: OutcomeResult;
  failureMessage?: string;
}

export interface InterpretedReport {
  cases: InterpretedTestCase[];
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
 * (FR-15, ADR-0005). Collisions (two test cases sharing classname+name in one Report) are
 * handled naively — both are returned as separate cases — until ticket 08 detects and
 * warns on them.
 */
export function interpret(xml: string): InterpretedReport {
  const doc = parser.parse(xml) as RawDocument;
  const suites = doc.testsuites?.testsuite ?? doc.testsuite ?? [];

  const cases = suites.flatMap((suite) => (suite.testcase ?? []).map(interpretTestCase));
  return { cases };
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
