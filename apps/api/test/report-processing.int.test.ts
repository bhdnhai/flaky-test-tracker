import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { submitReportResponseSchema } from '@ftt/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadConfig, TestClock } from '../src/platform/index.js';
import { PrismaService } from '../src/platform/prisma.service.js';
import { ProjectsService } from '../src/projects/index.js';
import { ReportIntakeService } from '../src/report-intake/index.js';
import {
  ReportNotFoundError,
  ReportNotReprocessableError,
  ReportProcessingService,
  ReportQueueService,
} from '../src/report-processing/index.js';
import { createTestDatabase } from './support/database.js';
import { createHttpTestContext } from './support/http.js';

const SOME_COMMIT = 'a'.repeat(40);

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

describe('ReportProcessingService (via the Nest application context)', () => {
  let app: INestApplicationContext | undefined;

  afterEach(async () => {
    await app?.close();
  });

  interface Context {
    projects: ProjectsService;
    reportIntake: ReportIntakeService;
    processing: ReportProcessingService;
    prisma: PrismaService;
  }

  async function createContext(): Promise<Context> {
    const config = loadConfig({ DATABASE_URL: await createTestDatabase() });
    app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: false });
    return {
      projects: app.get(ProjectsService),
      reportIntake: app.get(ReportIntakeService),
      processing: app.get(ReportProcessingService),
      prisma: app.get(PrismaService),
    };
  }

  it('AC-11: processes a passing, a failed, an errored and a skipped test case into 4 Tests and their Outcomes, and marks the Report processed', async () => {
    const { projects, reportIntake, processing, prisma } = await createContext();
    const { project } = await projects.create('web-app');
    const { report: submitted } = await reportIntake.submit({
      project,
      commitSha: SOME_COMMIT,
      metadata: {},
      body: Buffer.from(FOUR_CASE_REPORT),
    });

    const didWork = await processing.processNext(new Date());

    expect(didWork).toBe(true);
    const report = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(report.processingState).toBe('processed');
    expect(report.processedAt).not.toBeNull();

    const tests = await prisma.test.findMany({ where: { projectId: project.id } });
    expect(tests).toHaveLength(4);
    expect(tests.every((t) => t.classname === 'C')).toBe(true);

    const outcomes = await prisma.outcome.findMany({ where: { reportId: submitted.id } });
    const byTestName = new Map(
      outcomes.map((o) => [tests.find((t) => t.id === o.testId)!.name, o]),
    );

    expect(byTestName.get('passes')).toMatchObject({ result: 'passed', failureMessage: null });
    expect(byTestName.get('fails')).toMatchObject({ result: 'failed' });
    expect(byTestName.get('fails')!.failureMessage).toContain('boom');
    expect(byTestName.get('errors')).toMatchObject({ result: 'failed' });
    expect(byTestName.get('errors')!.failureMessage).toContain('kaboom');
    expect(byTestName.get('skips')).toMatchObject({ result: 'skipped', failureMessage: null });

    // commitSha and receivedAt are copied from the Report (design §6), not the processing time.
    expect(outcomes.every((o) => o.commitSha === SOME_COMMIT)).toBe(true);
    expect(outcomes.every((o) => o.receivedAt.getTime() === report.receivedAt.getTime())).toBe(
      true,
    );
  });

  it('FR-13: processNext returns false and does nothing when no Report is pending', async () => {
    const { processing } = await createContext();

    const didWork = await processing.processNext(new Date());

    expect(didWork).toBe(false);
  });

  it('AC-14: a Playwright Report with two projects and no includeProjectInTestName (chromium passed, firefox failed on the same identity) is processed with a Collision warning mentioning includeProjectInTestName, no Test and no Outcome for that identity', async () => {
    const twoProjectReport = `
<testsuites>
  <testsuite name="spec" hostname="chromium">
    <testcase classname="spec.ts" name="t" />
  </testsuite>
  <testsuite name="spec" hostname="firefox">
    <testcase classname="spec.ts" name="t">
      <failure message="failed on firefox">boom</failure>
    </testcase>
  </testsuite>
</testsuites>`;
    const { projects, reportIntake, processing, prisma } = await createContext();
    const { project } = await projects.create('web-app');
    const { report: submitted } = await reportIntake.submit({
      project,
      commitSha: SOME_COMMIT,
      metadata: {},
      body: Buffer.from(twoProjectReport),
    });

    await processing.processNext(new Date());

    const report = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(report.processingState).toBe('processed');
    expect(report.collisionWarning).toMatchObject({
      identities: [{ classname: 'spec.ts', name: 't' }],
    });
    expect(JSON.stringify(report.collisionWarning)).toContain('includeProjectInTestName');

    const tests = await prisma.test.findMany({ where: { projectId: project.id } });
    expect(tests).toHaveLength(0);
    const outcomes = await prisma.outcome.findMany({ where: { reportId: submitted.id } });
    expect(outcomes).toHaveLength(0);
  });

  it('AC-15: the same Playwright suite reported with includeProjectInTestName: true produces two distinct Tests and no Collision warning', async () => {
    const twoProjectReportFixed = `
<testsuites>
  <testsuite name="spec" hostname="chromium">
    <testcase classname="spec.ts" name="[chromium] t" />
  </testsuite>
  <testsuite name="spec" hostname="firefox">
    <testcase classname="spec.ts" name="[firefox] t">
      <failure message="failed on firefox">boom</failure>
    </testcase>
  </testsuite>
</testsuites>`;
    const { projects, reportIntake, processing, prisma } = await createContext();
    const { project } = await projects.create('web-app');
    const { report: submitted } = await reportIntake.submit({
      project,
      commitSha: SOME_COMMIT,
      metadata: {},
      body: Buffer.from(twoProjectReportFixed),
    });

    await processing.processNext(new Date());

    const report = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(report.processingState).toBe('processed');
    expect(report.collisionWarning).toBeNull();

    const tests = await prisma.test.findMany({ where: { projectId: project.id } });
    expect(tests).toHaveLength(2);
    const outcomes = await prisma.outcome.findMany({ where: { reportId: submitted.id } });
    expect(outcomes).toHaveLength(2);
  });
});

describe('ReportProcessingService — reliability (ticket 09)', () => {
  let app: INestApplicationContext | undefined;

  afterEach(async () => {
    await app?.close();
  });

  const POISON_REPORT = `
<testsuites>
  <testsuite name="suite">
    <testcase name="missing-classname" />
  </testsuite>
</testsuites>`;

  it('AC-13: a well-formed Report with a test case the parser can\'t read still gets 202, then fails after 3 attempts with an error', async () => {
    const context = await createHttpTestContext();
    app = context.app;
    const { server, projects, prisma } = context;
    const { token } = await projects.create('web-app');
    const processing = app.get(ReportProcessingService);
    const clock = new TestClock(new Date('2026-01-01T00:00:00.000Z'));

    const res = await request(server)
      .post(`/api/v1/reports?commit=${SOME_COMMIT}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/xml')
      .send(POISON_REPORT);

    expect(res.status).toBe(202);
    const reportId = submitReportResponseSchema.parse(res.body).id;

    // Attempt 1: fails; attempts (1) < 3, so pending with a 2^1 = 2s back-off.
    await processing.processNext(clock.now());
    let report = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
    expect(report.processingState).toBe('pending');
    expect(report.processingAttempts).toBe(1);
    expect(report.nextAttemptAt?.getTime()).toBe(clock.now().getTime() + 2_000);
    expect(report.error).toBeTruthy();

    // Not due yet: the worker finds nothing to do.
    expect(await processing.processNext(clock.now())).toBe(false);

    // Attempt 2: fails; attempts (2) < 3, so pending with a 2^2 = 4s back-off.
    clock.advanceBy(2_000);
    await processing.processNext(clock.now());
    report = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
    expect(report.processingState).toBe('pending');
    expect(report.processingAttempts).toBe(2);

    // Attempt 3: fails; attempts (3) is no longer < 3, so failed with the error.
    clock.advanceBy(4_000);
    await processing.processNext(clock.now());
    report = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
    expect(report.processingState).toBe('failed');
    expect(report.processingAttempts).toBe(3);
    expect(report.nextAttemptAt).toBeNull();
    expect(report.error).toBeTruthy();
  });

  async function createContext(): Promise<{
    projects: ProjectsService;
    reportIntake: ReportIntakeService;
    processing: ReportProcessingService;
    prisma: PrismaService;
  }> {
    const config = loadConfig({ DATABASE_URL: await createTestDatabase() });
    const context = await NestFactory.createApplicationContext(AppModule.forRoot(config), {
      logger: false,
    });
    app = context;
    return {
      projects: context.get(ProjectsService),
      reportIntake: context.get(ReportIntakeService),
      processing: context.get(ReportProcessingService),
      prisma: context.get(PrismaService),
    };
  }

  it('AC-16: reprocessing a processed Report (a simulated retry) does not change its Outcome count', async () => {
    const { projects, reportIntake, processing, prisma } = await createContext();
    const { project } = await projects.create('web-app');
    const { report: submitted } = await reportIntake.submit({
      project,
      commitSha: SOME_COMMIT,
      metadata: {},
      body: Buffer.from(FOUR_CASE_REPORT),
    });

    await processing.processNext(new Date());
    const outcomesAfterFirst = await prisma.outcome.findMany({
      where: { reportId: submitted.id },
    });
    expect(outcomesAfterFirst).toHaveLength(4);

    // Simulate a retry: the Report goes back to `pending`, as `reprocess-report` (ticket 15)
    // or a crashed claim's retry would leave it, without touching the Outcomes already there.
    await prisma.report.update({
      where: { id: submitted.id },
      data: { processingState: 'pending', processedAt: null },
    });

    await processing.processNext(new Date());
    const report = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(report.processingState).toBe('processed');

    const outcomesAfterSecond = await prisma.outcome.findMany({
      where: { reportId: submitted.id },
    });
    expect(outcomesAfterSecond).toHaveLength(4);
  });

  it('AC-17: a killed worker\'s claim expires after 60s and the Report is then processed exactly once', async () => {
    const { projects, reportIntake, processing, prisma } = await createContext();
    const { project } = await projects.create('web-app');
    const { report: submitted } = await reportIntake.submit({
      project,
      commitSha: SOME_COMMIT,
      metadata: {},
      body: Buffer.from(FOUR_CASE_REPORT),
    });

    const clock = new TestClock(new Date('2026-01-01T00:00:00.000Z'));

    // Simulate a worker claiming the Report, then being killed before completing.
    await prisma.report.update({
      where: { id: submitted.id },
      data: { processingState: 'processing', claimedAt: clock.now(), processingAttempts: 1 },
    });

    // Under 60s: the claim is still live, nothing to release or claim.
    clock.advanceBy(59_000);
    await processing.sweep(clock.now());
    let report = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(report.processingState).toBe('processing');
    expect(await processing.processNext(clock.now())).toBe(false);

    // Past 60s: the claim is released back to `pending` and can be claimed again.
    clock.advanceBy(2_000);
    await processing.sweep(clock.now());
    report = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(report.processingState).toBe('pending');

    const didWork = await processing.processNext(clock.now());
    expect(didWork).toBe(true);
    report = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(report.processingState).toBe('processed');

    const outcomes = await prisma.outcome.findMany({ where: { reportId: submitted.id } });
    expect(outcomes).toHaveLength(4);
  });

  it('AC-18: Reports submitted while the worker is stopped stay pending, and all reach processed once it starts', async () => {
    const { projects, reportIntake, processing, prisma } = await createContext();
    const { project } = await projects.create('web-app');

    const submittedIds: string[] = [];
    // Distinct commits: identical (project, commit, content) would be a duplicate (FR-12),
    // not a 2nd and 3rd Report.
    for (const commitSha of ['a', 'b', 'c'].map((c) => c.repeat(40))) {
      const { report } = await reportIntake.submit({
        project,
        commitSha,
        metadata: {},
        body: Buffer.from(FOUR_CASE_REPORT),
      });
      submittedIds.push(report.id);
      expect(report.processingState).toBe('pending');
    }

    const pendingReports = await prisma.report.findMany({
      where: { id: { in: submittedIds } },
    });
    expect(pendingReports.every((r) => r.processingState === 'pending')).toBe(true);

    for (let i = 0; i < 3; i++) {
      expect(await processing.processNext(new Date())).toBe(true);
    }
    expect(await processing.processNext(new Date())).toBe(false);

    const processedReports = await prisma.report.findMany({
      where: { id: { in: submittedIds } },
    });
    expect(processedReports.every((r) => r.processingState === 'processed')).toBe(true);
  });
});

describe('ReportQueueService.requeue (Operator CLI: reprocess-report, ticket 15)', () => {
  let app: INestApplicationContext | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createContext(): Promise<{
    projects: ProjectsService;
    reportIntake: ReportIntakeService;
    processing: ReportProcessingService;
    queue: ReportQueueService;
    prisma: PrismaService;
  }> {
    const config = loadConfig({ DATABASE_URL: await createTestDatabase() });
    const context = await NestFactory.createApplicationContext(AppModule.forRoot(config), {
      logger: false,
    });
    app = context;
    return {
      projects: context.get(ProjectsService),
      reportIntake: context.get(ReportIntakeService),
      processing: context.get(ReportProcessingService),
      queue: context.get(ReportQueueService),
      prisma: context.get(PrismaService),
    };
  }

  it('AC-32: reprocess-report returns a failed Report to pending, and it is processed again', async () => {
    const { projects, reportIntake, processing, queue, prisma } = await createContext();
    const { project } = await projects.create('web-app');
    const { report: submitted } = await reportIntake.submit({
      project,
      commitSha: SOME_COMMIT,
      metadata: {},
      body: Buffer.from(FOUR_CASE_REPORT),
    });
    // Simulate a Report that failed after exhausting its attempts (FR-19).
    await prisma.report.update({
      where: { id: submitted.id },
      data: { processingState: 'failed', processingAttempts: 3, error: 'boom', claimedAt: null },
    });

    await queue.requeue(submitted.id);

    const requeued = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(requeued.processingState).toBe('pending');
    expect(requeued.processingAttempts).toBe(0);
    expect(requeued.error).toBeNull();

    const didWork = await processing.processNext(new Date());
    expect(didWork).toBe(true);
    const report = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(report.processingState).toBe('processed');
  });

  it('AC-32: reprocessing an already-processed Report returns it to pending without changing its Outcome count (FR-18)', async () => {
    const { projects, reportIntake, processing, queue, prisma } = await createContext();
    const { project } = await projects.create('web-app');
    const { report: submitted } = await reportIntake.submit({
      project,
      commitSha: SOME_COMMIT,
      metadata: {},
      body: Buffer.from(FOUR_CASE_REPORT),
    });
    await processing.processNext(new Date());
    const outcomesBefore = await prisma.outcome.findMany({ where: { reportId: submitted.id } });
    expect(outcomesBefore).toHaveLength(4);

    await queue.requeue(submitted.id);
    const requeued = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(requeued.processingState).toBe('pending');

    await processing.processNext(new Date());
    const report = await prisma.report.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(report.processingState).toBe('processed');
    const outcomesAfter = await prisma.outcome.findMany({ where: { reportId: submitted.id } });
    expect(outcomesAfter).toHaveLength(4);
  });

  it('reprocess-report rejects a pending Report', async () => {
    const { projects, reportIntake, queue } = await createContext();
    const { project } = await projects.create('web-app');
    const { report: submitted } = await reportIntake.submit({
      project,
      commitSha: SOME_COMMIT,
      metadata: {},
      body: Buffer.from(FOUR_CASE_REPORT),
    });

    await expect(queue.requeue(submitted.id)).rejects.toThrow(ReportNotReprocessableError);
  });

  it('reprocess-report rejects an unknown Report ID', async () => {
    const { queue } = await createContext();

    await expect(queue.requeue('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      ReportNotFoundError,
    );
  });
});
