import type { INestApplication } from '@nestjs/common';
import { errorEnvelopeSchema, submitReportResponseSchema } from '@ftt/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttpTestContext, type HttpTestContext } from './support/http.js';
import { SAMPLE_JUNIT_XML } from './support/junit-fixtures.js';

const SOME_COMMIT = 'a'.repeat(40);

describe('POST /api/v1/reports', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createContext(): Promise<HttpTestContext> {
    const context = await createHttpTestContext();
    app = context.app;
    return context;
  }

  it('AC-04: accepts a valid submission, returning 202 pending, with byte-identical stored content', async () => {
    const { server, projects, prisma } = await createContext();
    const { token } = await projects.create('web-app');

    const res = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(res.status).toBe(202);
    const body = submitReportResponseSchema.parse(res.body);
    expect(body).toMatchObject({ processingState: 'pending', duplicate: false });

    const content = await prisma.reportContent.findUniqueOrThrow({
      where: { reportId: body.id },
    });
    expect(Buffer.from(content.body).equals(Buffer.from(SAMPLE_JUNIT_XML))).toBe(true);
  });

  it('AC-05: rejects a submission with no Authorization header with 401, storing nothing', async () => {
    const { server, projects, prisma } = await createContext();
    await projects.create('web-app');

    const res = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(res.status).toBe(401);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('UNAUTHORIZED');
    expect(await prisma.report.count()).toBe(0);
  });

  it('AC-05: rejects a malformed Authorization header with the same 401 message as a missing one', async () => {
    const { server, prisma } = await createContext();

    const missing = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);
    const malformed = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', 'not-a-bearer-token')
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(malformed.status).toBe(401);
    expect(errorEnvelopeSchema.parse(malformed.body).error.message).toBe(
      errorEnvelopeSchema.parse(missing.body).error.message,
    );
    expect(await prisma.report.count()).toBe(0);
  });

  it('AC-05: rejects an unknown token with 401, storing nothing', async () => {
    const { server, prisma } = await createContext();

    const res = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', 'Bearer ftt_doesnotexist')
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(res.status).toBe(401);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('UNAUTHORIZED');
    expect(await prisma.report.count()).toBe(0);
  });

  it.each([
    ['missing', undefined],
    ['too short', 'abc123'],
    ['39 hex characters', 'a'.repeat(39)],
    ['40 characters containing g', `${'a'.repeat(39)}g`],
  ])('AC-06: rejects commit=%s with 400 INVALID_COMMIT', async (_label, commit) => {
    const { server, projects } = await createContext();
    const { token } = await projects.create('web-app');
    const query = commit === undefined ? '' : `?commit=${commit}`;

    const res = await request(server)
      .post(`/api/v1/reports${query}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(res.status).toBe(400);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('INVALID_COMMIT');
  });

  it('AC-06: accepts an uppercase 40-character SHA and stores it lowercase', async () => {
    const { server, projects, prisma } = await createContext();
    const { token } = await projects.create('web-app');
    const upper = 'A'.repeat(40);

    const res = await request(server)
      .post(`/api/v1/reports?commit=${upper}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(res.status).toBe(202);
    const body = submitReportResponseSchema.parse(res.body);
    const stored = await prisma.report.findUniqueOrThrow({ where: { id: body.id } });
    expect(stored.commitSha).toBe(upper.toLowerCase());
  });

  it.each(['0', 'x'])(
    'AC-07: rejects runAttempt=%s with 400 VALIDATION_ERROR',
    async (runAttempt) => {
      const { server, projects } = await createContext();
      const { token } = await projects.create('web-app');

      const res = await request(server)
        .post(`/api/v1/reports?commit=${SOME_COMMIT}&runAttempt=${runAttempt}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/xml')
        .send(SAMPLE_JUNIT_XML);

      expect(res.status).toBe(400);
      expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('AC-07: stores branch, runId, runAttempt and job as received', async () => {
    const { server, projects, prisma } = await createContext();
    const { token } = await projects.create('web-app');

    const res = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}&branch=main&runId=123&runAttempt=2&job=test`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(res.status).toBe(202);
    const body = submitReportResponseSchema.parse(res.body);
    const stored = await prisma.report.findUniqueOrThrow({ where: { id: body.id } });
    expect(stored).toMatchObject({
      branch: 'main',
      ciRunId: '123',
      ciRunAttempt: 2,
      ciJob: 'test',
    });
  });

  it('AC-03: a submission with the rotated-out token gets 401, the same submission with the new token gets 202', async () => {
    const { server, projects } = await createContext();
    const { token: t1 } = await projects.create('web-app');
    const t2 = await projects.rotateToken('web-app');

    const withOld = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${t1}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);
    const withNew = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${t2}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(withOld.status).toBe(401);
    expect(withNew.status).toBe(202);
  });

  it('AC-08, FR-11: refuses a submission whose Content-Type is not application/xml or text/xml, instead of silently storing empty content', async () => {
    const { server, projects, prisma } = await createContext();
    const { token } = await projects.create('web-app');

    const res = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(SAMPLE_JUNIT_XML);

    expect(res.status).toBe(415);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await prisma.report.count()).toBe(0);
  });

  it('AC-08: rejects an empty body with 400 EMPTY_REPORT, storing nothing', async () => {
    const { server, projects, prisma } = await createContext();
    const { token } = await projects.create('web-app');

    const res = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send('');

    expect(res.status).toBe(400);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('EMPTY_REPORT');
    expect(await prisma.report.count()).toBe(0);
  });

  it('AC-08: rejects a body over 10 MB with 413 REPORT_TOO_LARGE, storing nothing', async () => {
    const { server, projects, prisma } = await createContext();
    const { token } = await projects.create('web-app');
    const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1, 'a');

    const res = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(tooLarge);

    expect(res.status).toBe(413);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('REPORT_TOO_LARGE');
    expect(await prisma.report.count()).toBe(0);
  });

  it.each([
    ['truncated XML', '<testsuite name="x"><testcase classname="C" name="t">'],
    ['a non-report root element', '<html><body>not a report</body></html>'],
    [
      'a DOCTYPE with a SYSTEM external entity',
      '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><testsuite>&e;</testsuite>',
    ],
  ])(
    'AC-09, NFR-07: rejects %s with 422 MALFORMED_REPORT, storing nothing',
    async (_label, xml) => {
      const { server, projects, prisma } = await createContext();
      const { token } = await projects.create('web-app');

      const res = await request(server)
        .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/xml')
        .send(xml);

      expect(res.status).toBe(422);
      expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('MALFORMED_REPORT');
      expect(await prisma.report.count()).toBe(0);
    },
  );

  it('AC-10: resubmitting the identical body for the same Commit is a safe no-op: 200, the original id, duplicate: true, one Report', async () => {
    const { server, projects, prisma } = await createContext();
    const { token } = await projects.create('web-app');

    const first = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);
    const second = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(first.status).toBe(202);
    expect(second.status).toBe(200);
    const firstBody = submitReportResponseSchema.parse(first.body);
    const secondBody = submitReportResponseSchema.parse(second.body);
    expect(secondBody).toMatchObject({ id: firstBody.id, duplicate: true });
    expect(await prisma.report.count()).toBe(1);
  });

  it('AC-10: resubmitting the identical body for a different Commit is a new Report: 202, a new id', async () => {
    const { server, projects } = await createContext();
    const { token } = await projects.create('web-app');
    const otherCommit = 'b'.repeat(40);

    const first = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);
    const second = await request(server)
      .post(`/api/v1/reports?commit=${otherCommit}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);

    expect(second.status).toBe(202);
    const firstBody = submitReportResponseSchema.parse(first.body);
    const secondBody = submitReportResponseSchema.parse(second.body);
    expect(secondBody.id).not.toBe(firstBody.id);
  });

  it('AC-10: two concurrent identical submissions for the same Commit race-safely produce one Report', async () => {
    const { server, projects, prisma } = await createContext();
    const { token } = await projects.create('web-app');

    const [a, b] = await Promise.all([
      request(server)
        .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/xml')
        .send(SAMPLE_JUNIT_XML),
      request(server)
        .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/xml')
        .send(SAMPLE_JUNIT_XML),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 202]);
    const ids = [a.body, b.body].map((body) => submitReportResponseSchema.parse(body).id);
    expect(ids[0]).toBe(ids[1]);
    expect(await prisma.report.count()).toBe(1);
  });
});
