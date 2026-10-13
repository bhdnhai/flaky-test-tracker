import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpTestContext, type HttpTestContext } from './support/http.js';
import { createLogCapture, type CapturedLogs } from './support/logger.js';
import { SAMPLE_JUNIT_XML } from './support/junit-fixtures.js';

const SOME_COMMIT = 'a'.repeat(40);

/** pino-http's autologging nests the request id under `req.id` (pino-http's own default shape). */
function requestIdOf(line: Record<string, unknown>): unknown {
  return (line.req as { id?: unknown } | undefined)?.id;
}

// nestjs-pino builds its one pino-http instance on first use per process and keeps it (it has
// no HTTP-level concept of "one app"), so every app sharing this process shares one logger:
// one app, and one capture, for the whole file (unlike the other integration suites' per-test
// `createHttpTestContext()`, which is fine for them since they don't inspect log output).
describe('Observability (ticket 10)', () => {
  let app: INestApplication | undefined;
  let context: HttpTestContext;
  let capture: CapturedLogs;

  beforeAll(async () => {
    capture = createLogCapture();
    context = await createHttpTestContext(capture.stream);
    app = context.app;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('AC-38: echoes a supplied X-Request-Id and a log line carries the same id', async () => {
    const res = await request(context.server).get('/health').set('X-Request-Id', 'demo-1');

    expect(res.headers['x-request-id']).toBe('demo-1');
    const matching = capture.lines().filter((line) => requestIdOf(line) === 'demo-1');
    expect(matching.length).toBeGreaterThan(0);
  });

  it('AC-38: generates an X-Request-Id when none is supplied, matching a log line', async () => {
    const res = await request(context.server).get('/health');

    const requestId = res.headers['x-request-id'];
    expect(typeof requestId).toBe('string');
    expect(requestId).not.toBe('');
    const matching = capture.lines().filter((line) => requestIdOf(line) === requestId);
    expect(matching.length).toBeGreaterThan(0);
  });

  it('AC-05: an authenticated submission never writes the upload token to the logs', async () => {
    const { token } = await context.projects.create('logs-web-app');

    await request(context.server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(capture.raw()).not.toContain(token);
    expect(capture.raw()).not.toContain('ftt_');
  });

  it('AC-05: a rejected submission never writes the attempted token to the logs', async () => {
    await request(context.server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', 'Bearer ftt_doesnotexist')
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(capture.raw()).not.toContain('ftt_doesnotexist');
  });
});
