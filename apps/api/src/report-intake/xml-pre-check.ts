import { XMLValidator } from 'fast-xml-parser';
import { ApiError } from '../platform/index.js';

const DOCTYPE_PATTERN = /<!DOCTYPE/i;
const ROOT_ELEMENT_PATTERN = /<\s*([A-Za-z_][\w:.-]*)/;
const ROOT_ELEMENT_NAMES = new Set(['testsuites', 'testsuite']);

/**
 * Design §5 step 6 / §7: a Report body must have no DOCTYPE, be well-formed XML, and have a
 * `testsuites` or `testsuite` root, checked in that order (FR-10, NFR-07, AC-09). Synchronous,
 * no I/O. The DOCTYPE check runs on the raw bytes before any parser sees them, so a `SYSTEM`
 * external entity is never resolved — rejecting it here, rather than relying on the parser's
 * own entity handling, is what keeps that true regardless of parser behaviour.
 */
export function xmlPreCheck(body: Buffer): void {
  const xml = body.toString('utf-8');

  if (DOCTYPE_PATTERN.test(xml)) {
    throw new ApiError('MALFORMED_REPORT', 'XML DOCTYPE declarations are not allowed');
  }

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new ApiError('MALFORMED_REPORT', validation.err.msg);
  }

  const root = rootElementNameOf(xml);
  if (!root || !ROOT_ELEMENT_NAMES.has(root)) {
    throw new ApiError(
      'MALFORMED_REPORT',
      `Root element must be <testsuites> or <testsuite>, got <${root ?? ''}>`,
    );
  }
}

function rootElementNameOf(xml: string): string | undefined {
  const withoutBom = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const withoutProlog = withoutBom.replace(/^\s*<\?xml[^>]*\?>/i, '');
  return ROOT_ELEMENT_PATTERN.exec(withoutProlog)?.[1];
}
