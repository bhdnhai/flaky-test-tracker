import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadConfig } from '../src/platform/index.js';
import { PrismaService } from '../src/platform/prisma.service.js';
import { ProjectsService } from '../src/projects/index.js';
import { ReportIntakeService } from '../src/report-intake/index.js';
import { ReportProcessingService } from '../src/report-processing/index.js';
import { createTestDatabase } from './support/database.js';

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
