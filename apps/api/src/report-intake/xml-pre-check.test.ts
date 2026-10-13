import { describe, expect, it } from 'vitest';
import { xmlPreCheck } from './xml-pre-check.js';

function expectMalformed(xml: string): void {
  expect(() => xmlPreCheck(Buffer.from(xml))).toThrowError(
    expect.objectContaining({ code: 'MALFORMED_REPORT' }),
  );
}

describe('xmlPreCheck', () => {
  it('AC-09: accepts a well-formed <testsuite> root', () => {
    expect(() =>
      xmlPreCheck(Buffer.from('<testsuite name="x"><testcase classname="C" name="t" /></testsuite>')),
    ).not.toThrow();
  });

  it('AC-09: accepts a well-formed <testsuites> root', () => {
    expect(() =>
      xmlPreCheck(
        Buffer.from('<testsuites><testsuite name="x"><testcase classname="C" name="t" /></testsuite></testsuites>'),
      ),
    ).not.toThrow();
  });

  it('AC-09: rejects truncated XML', () => {
    expectMalformed('<testsuite name="x"><testcase classname="C" name="t">');
  });

  it('AC-09: rejects a well-formed document whose root is not testsuites/testsuite', () => {
    expectMalformed('<html><body>not a report</body></html>');
  });

  it('AC-09, NFR-07: rejects a DOCTYPE with a SYSTEM external entity before any parsing', () => {
    expectMalformed(
      '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><testsuite>&e;</testsuite>',
    );
  });

  it('AC-09, NFR-07: rejects any DOCTYPE, even a harmless-looking one', () => {
    expectMalformed('<!DOCTYPE testsuite><testsuite name="x" />');
  });
});
