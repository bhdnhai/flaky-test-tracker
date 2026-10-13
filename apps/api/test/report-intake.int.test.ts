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

  it('FR-11: refuses a submission whose Content-Type is not application/xml or text/xml, instead of silently storing empty content', async () => {
    const { server, projects, prisma } = await createContext();
    const { token } = await projects.create('web-app');

    const res = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(SAMPLE_JUNIT_XML);

    expect(res.status).toBe(400);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.report.count()).toBe(0);
  });
});
