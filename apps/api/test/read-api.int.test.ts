import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  errorEnvelopeSchema,
  flakyTestsListResponseSchema,
  projectsListResponseSchema,
  reportListItemSchema,
  reportsListResponseSchema,
  submitReportResponseSchema,
  testDetailResponseSchema,
  testSearchResponseSchema,
} from '@ftt/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttpTestContext, type HttpTestContext } from './support/http.js';
import { SAMPLE_JUNIT_XML } from './support/junit-fixtures.js';

const SOME_COMMIT = 'b'.repeat(40);

describe('Read API: Projects and Reports (FR-26, FR-30)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createContext(): Promise<HttpTestContext> {
    const context = await createHttpTestContext();
    app = context.app;
    return context;
  }

  it('AC-26: GET /api/v1/projects lists Projects by name', async () => {
    const { projects, server } = await createContext();
    await projects.create('web-app');
    await projects.create('api');

    const res = await request(server).get('/api/v1/projects');

    expect(res.status).toBe(200);
    const body = projectsListResponseSchema.parse(res.body);
    expect(body.items.map((p) => p.name)).toEqual(['api', 'web-app']);
  });

  it('AC-26: GET .../reports lists a Project’s Reports newest first with their processing state', async () => {
    const { projects, server } = await createContext();
    const { token } = await projects.create('web-app');
    await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);
    const submittedRes = await request(server)
      .post(`/api/v1/reports?commit=${'c'.repeat(40)}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);
    const submitted = submitReportResponseSchema.parse(submittedRes.body);
    const projectId = (await projects.list())[0]!.id;

    const res = await request(server).get(`/api/v1/projects/${projectId}/reports`);

    expect(res.status).toBe(200);
    const body = reportsListResponseSchema.parse(res.body);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]!.id).toBe(submitted.id);
    expect(body.items.every((item) => item.processingState === 'pending')).toBe(true);
  });

  it('AC-07: branch, runId, runAttempt and job submitted with a Report appear on it in the Reports list', async () => {
    const { projects, server } = await createContext();
    const { token } = await projects.create('web-app');
    await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}&branch=main&runId=123&runAttempt=2&job=test`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);
    const projectId = (await projects.list())[0]!.id;

    const res = await request(server).get(`/api/v1/projects/${projectId}/reports`);

    const body = reportsListResponseSchema.parse(res.body);
    expect(body.items).toMatchObject([
      { branch: 'main', runId: '123', runAttempt: 2, job: 'test' },
    ]);
  });

  it('SRS §9.2: GET .../reports/{reportId} returns one Report in the same shape as the list', async () => {
    const { projects, server } = await createContext();
    const { token } = await projects.create('web-app');
    const submittedRes = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);
    const submitted = submitReportResponseSchema.parse(submittedRes.body);
    const projectId = (await projects.list())[0]!.id;

    const res = await request(server).get(`/api/v1/projects/${projectId}/reports/${submitted.id}`);

    expect(res.status).toBe(200);
    const body = reportListItemSchema.parse(res.body);
    expect(body).toMatchObject({ id: submitted.id, commitSha: SOME_COMMIT });
  });

  it('SRS §10: an unknown projectId returns 404 NOT_FOUND', async () => {
    const { server } = await createContext();

    const res = await request(server).get(`/api/v1/projects/${randomUUID()}/reports`);

    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('SRS §7: a malformed projectId fails the same way an unknown one does, not with a 500', async () => {
    const { server } = await createContext();

    const res = await request(server).get('/api/v1/projects/not-a-uuid/reports');

    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('SRS §10: a Report that belongs to another Project returns 404 NOT_FOUND', async () => {
    const { projects, server } = await createContext();
    const { token: tokenA } = await projects.create('web-app');
    await projects.create('api');
    const submittedRes = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Content-Type', 'application/xml')
      .send(SAMPLE_JUNIT_XML);
    const submitted = submitReportResponseSchema.parse(submittedRes.body);
    const otherProjectId = (await projects.list()).find((p) => p.name === 'api')!.id;

    const res = await request(server).get(
      `/api/v1/projects/${otherProjectId}/reports/${submitted.id}`,
    );

    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });
});

describe('Read API: Flaky Tests (FR-21, FR-22, FR-23, FR-27)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createContext(): Promise<HttpTestContext> {
    const context = await createHttpTestContext();
    app = context.app;
    return context;
  }

  it('FR-27: GET .../flaky-tests reports the configured window and an empty list for a Project with no Flakes', async () => {
    const { projects, server } = await createContext();
    const { project } = await projects.create('web-app');

    const res = await request(server).get(`/api/v1/projects/${project.id}/flaky-tests`);

    expect(res.status).toBe(200);
    const body = flakyTestsListResponseSchema.parse(res.body);
    expect(body).toEqual({ windowDays: 14, items: [] });
  });

  it('SRS §10: an unknown projectId on GET .../flaky-tests returns 404 NOT_FOUND', async () => {
    const { server } = await createContext();

    const res = await request(server).get(`/api/v1/projects/${randomUUID()}/flaky-tests`);

    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });
});

describe('Read API: Test search and detail (FR-24, FR-25, FR-28, FR-29)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createContext(): Promise<HttpTestContext> {
    const context = await createHttpTestContext();
    app = context.app;
    return context;
  }

  async function seedTest(
    prisma: HttpTestContext['prisma'],
    opts: { projectId: string; classname: string; name: string },
  ): Promise<string> {
    const test = await prisma.test.create({ data: opts });
    return test.id;
  }

  it('AC-23: search finds a Test with no Flakes by a substring of its classname', async () => {
    const { projects, prisma, server } = await createContext();
    const { project } = await projects.create('web-app');
    await seedTest(prisma, {
      projectId: project.id,
      classname: 'report ingestion',
      name: 'parses',
    });

    const res = await request(server).get(`/api/v1/projects/${project.id}/tests?search=INGEST`);

    expect(res.status).toBe(200);
    const body = testSearchResponseSchema.parse(res.body);
    expect(body.items).toMatchObject([
      { classname: 'report ingestion', name: 'parses', totalFlakes: 0 },
    ]);
  });

  it('AC-24: a search query of 1 or 201 characters returns 400 VALIDATION_ERROR', async () => {
    const { projects, server } = await createContext();
    const { project } = await projects.create('web-app');

    const tooShort = await request(server).get(`/api/v1/projects/${project.id}/tests?search=a`);
    const tooLong = await request(server).get(
      `/api/v1/projects/${project.id}/tests?search=${'a'.repeat(201)}`,
    );

    for (const res of [tooShort, tooLong]) {
      expect(res.status).toBe(400);
      expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('AC-25: Test detail returns the verdict first, with the Test identity and Commit history', async () => {
    const { projects, prisma, server } = await createContext();
    const { project } = await projects.create('web-app');
    const testId = await seedTest(prisma, { projectId: project.id, classname: 'C', name: 'X' });
    const commitSha = 'a'.repeat(40);
    for (const result of ['passed', 'failed'] as const) {
      const report = await prisma.report.create({
        data: {
          projectId: project.id,
          commitSha,
          contentHash: randomUUID(),
          sizeBytes: 1,
          receivedAt: new Date(),
          processingState: 'processed',
        },
      });
      await prisma.outcome.create({
        data: {
          reportId: report.id,
          testId,
          projectId: project.id,
          commitSha,
          result,
          receivedAt: new Date(),
          failureMessage: result === 'failed' ? 'boom' : undefined,
        },
      });
    }

    const res = await request(server).get(`/api/v1/projects/${project.id}/tests/${testId}`);

    expect(res.status).toBe(200);
    const body = testDetailResponseSchema.parse(res.body);
    expect(body).toMatchObject({
      testId,
      classname: 'C',
      name: 'X',
      verdict: { flaky: true, totalFlakes: 1, flakesInWindow: 1 },
    });
    expect(body.history).toMatchObject([{ commitSha, isFlake: true, passed: 1, failed: 1 }]);
    expect(body.history[0]!.outcomes).toContainEqual(
      expect.objectContaining({ result: 'failed', failureMessage: 'boom' }),
    );
  });

  it('SRS §10: a Test from another Project returns 404 NOT_FOUND', async () => {
    const { projects, prisma, server } = await createContext();
    const { project: projectA } = await projects.create('web-app');
    const { project: projectB } = await projects.create('api');
    const testId = await seedTest(prisma, { projectId: projectA.id, classname: 'C', name: 'X' });

    const res = await request(server).get(`/api/v1/projects/${projectB.id}/tests/${testId}`);

    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('SRS §10: an unknown testId returns 404 NOT_FOUND', async () => {
    const { projects, server } = await createContext();
    const { project } = await projects.create('web-app');

    const res = await request(server).get(`/api/v1/projects/${project.id}/tests/${randomUUID()}`);

    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });
});
