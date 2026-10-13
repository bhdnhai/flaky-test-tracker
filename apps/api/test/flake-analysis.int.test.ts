import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { FlakeAnalysisService } from '../src/flake-analysis/index.js';
import { loadConfig } from '../src/platform/index.js';
import { PrismaService } from '../src/platform/prisma.service.js';
import { ProjectsService } from '../src/projects/index.js';
import { createTestDatabase } from './support/database.js';

type Result = 'passed' | 'failed' | 'skipped';

interface Context {
  projects: ProjectsService;
  flakeAnalysis: FlakeAnalysisService;
  prisma: PrismaService;
}

interface SeedOutcomeOpts {
  projectId: string;
  classname: string;
  name: string;
  commitSha: string;
  result: Result;
  receivedAt: Date;
  failureMessage?: string;
  branch?: string;
}

/** Seeds one Outcome, creating its Test and a throwaway Report to satisfy the FK. Returns the Report's id. */
async function seedOutcome(prisma: PrismaService, opts: SeedOutcomeOpts): Promise<string> {
  const test = await prisma.test.upsert({
    where: {
      projectId_classname_name: {
        projectId: opts.projectId,
        classname: opts.classname,
        name: opts.name,
      },
    },
    create: { projectId: opts.projectId, classname: opts.classname, name: opts.name },
    update: {},
  });
  const report = await prisma.report.create({
    data: {
      projectId: opts.projectId,
      commitSha: opts.commitSha,
      contentHash: randomUUID(),
      sizeBytes: 1,
      receivedAt: opts.receivedAt,
      processingState: 'processed',
      branch: opts.branch,
    },
  });
  await prisma.outcome.create({
    data: {
      reportId: report.id,
      testId: test.id,
      projectId: opts.projectId,
      commitSha: opts.commitSha,
      result: opts.result,
      receivedAt: opts.receivedAt,
      failureMessage: opts.failureMessage,
    },
  });
  return report.id;
}

/** Seeds a Flake for `name`: one passed and one failed Outcome on a fresh Commit. */
async function seedFlake(
  prisma: PrismaService,
  opts: { projectId: string; classname: string; name: string; receivedAt: Date },
): Promise<void> {
  const commitSha = randomUUID();
  await seedOutcome(prisma, { ...opts, commitSha, result: 'passed' });
  await seedOutcome(prisma, { ...opts, commitSha, result: 'failed' });
}

describe('FlakeAnalysisService.flakyTests (FR-21, FR-22, FR-23)', () => {
  let app: INestApplicationContext | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createContext(): Promise<Context> {
    const config = loadConfig({ DATABASE_URL: await createTestDatabase() });
    app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: false });
    return {
      projects: app.get(ProjectsService),
      flakeAnalysis: app.get(FlakeAnalysisService),
      prisma: app.get(PrismaService),
    };
  }

  it('AC-19: a Test that passed in one Report and failed in another on the same Commit has one Flake', async () => {
    const { projects, prisma, flakeAnalysis } = await createContext();
    const { project } = await projects.create('web-app');
    const now = new Date('2026-10-01T00:00:00Z');
    const commitSha = 'c'.repeat(40);
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'X',
      commitSha,
      result: 'passed',
      receivedAt: now,
    });
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'X',
      commitSha,
      result: 'failed',
      receivedAt: now,
    });

    const items = await flakeAnalysis.flakyTests(project.id, 14, now);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ classname: 'C', name: 'X', flakeCount: 1 });
  });

  it('AC-20: a Test that only ever fails, or passes and fails on different Commits, has no Flake', async () => {
    const { projects, prisma, flakeAnalysis } = await createContext();
    const { project } = await projects.create('web-app');
    const now = new Date('2026-10-01T00:00:00Z');
    const commitC1 = 'c1'.padEnd(40, '0');
    const commitC2 = 'c2'.padEnd(40, '0');
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'Y',
      commitSha: commitC1,
      result: 'failed',
      receivedAt: now,
    });
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'Y',
      commitSha: commitC2,
      result: 'failed',
      receivedAt: now,
    });
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'Z',
      commitSha: commitC1,
      result: 'passed',
      receivedAt: now,
    });
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'Z',
      commitSha: commitC2,
      result: 'failed',
      receivedAt: now,
    });

    const items = await flakeAnalysis.flakyTests(project.id, 14, now);

    expect(items).toHaveLength(0);
  });

  it('AC-21: a Test that was skipped and failed on the same Commit has no Flake', async () => {
    const { projects, prisma, flakeAnalysis } = await createContext();
    const { project } = await projects.create('web-app');
    const now = new Date('2026-10-01T00:00:00Z');
    const commitSha = 's'.repeat(40);
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'S',
      commitSha,
      result: 'skipped',
      receivedAt: now,
    });
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'S',
      commitSha,
      result: 'failed',
      receivedAt: now,
    });

    const items = await flakeAnalysis.flakyTests(project.id, 14, now);

    expect(items).toHaveLength(0);
  });

  it('AC-22: the list is ordered by Flake count then recency, excludes Flakes outside the window, and the window is configurable', async () => {
    const { projects, prisma, flakeAnalysis } = await createContext();
    const { project } = await projects.create('web-app');
    const now = new Date('2026-10-01T00:00:00Z');
    const daysAgo = (n: number): Date => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    for (const n of [0, 1, 3]) {
      await seedFlake(prisma, {
        projectId: project.id,
        classname: 'C',
        name: 'A',
        receivedAt: daysAgo(n),
      });
    }
    await seedFlake(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'B',
      receivedAt: daysAgo(2),
    });
    await seedFlake(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'C',
      receivedAt: daysAgo(5),
    });
    await seedFlake(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'D',
      receivedAt: daysAgo(20),
    });

    const withDefaultWindow = await flakeAnalysis.flakyTests(project.id, 14, now);
    expect(withDefaultWindow.map((item) => item.name)).toEqual(['A', 'B', 'C']);

    const with30DayWindow = await flakeAnalysis.flakyTests(project.id, 30, now);
    expect(with30DayWindow.map((item) => item.name)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('FlakeAnalysisService.search (FR-24)', () => {
  let app: INestApplicationContext | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createContext(): Promise<Context> {
    const config = loadConfig({ DATABASE_URL: await createTestDatabase() });
    app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: false });
    return {
      projects: app.get(ProjectsService),
      flakeAnalysis: app.get(FlakeAnalysisService),
      prisma: app.get(PrismaService),
    };
  }

  it('AC-23: a case-insensitive substring match over name and classname includes Tests with no Flakes, with their totalFlakes', async () => {
    const { projects, prisma, flakeAnalysis } = await createContext();
    const { project } = await projects.create('web-app');
    const now = new Date('2026-10-01T00:00:00Z');
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'report ingestion',
      name: 'parses',
      commitSha: 'a'.repeat(40),
      result: 'passed',
      receivedAt: now,
    });
    await seedFlake(prisma, {
      projectId: project.id,
      classname: 'checkout',
      name: 'pays',
      receivedAt: now,
    });
    await seedFlake(prisma, {
      projectId: project.id,
      classname: 'checkout',
      name: 'pays',
      receivedAt: now,
    });

    const results = await flakeAnalysis.search(project.id, 'INGEST');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      classname: 'report ingestion',
      name: 'parses',
      totalFlakes: 0,
    });

    const flakyResults = await flakeAnalysis.search(project.id, 'pays');
    expect(flakyResults).toMatchObject([{ name: 'pays', totalFlakes: 2 }]);
  });

  it('FR-24: results are sorted by name and capped at 50', async () => {
    const { projects, prisma, flakeAnalysis } = await createContext();
    const { project } = await projects.create('web-app');
    const now = new Date('2026-10-01T00:00:00Z');
    for (let i = 0; i < 55; i++) {
      await seedOutcome(prisma, {
        projectId: project.id,
        classname: 'C',
        name: `match-${String(i).padStart(2, '0')}`,
        commitSha: 'a'.repeat(40),
        result: 'passed',
        receivedAt: now,
      });
    }

    const results = await flakeAnalysis.search(project.id, 'match');

    expect(results).toHaveLength(50);
    expect(results.map((r) => r.name)).toEqual([...results.map((r) => r.name)].sort());
  });
});

describe('FlakeAnalysisService.testDetail (FR-25)', () => {
  let app: INestApplicationContext | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createContext(): Promise<Context> {
    const config = loadConfig({ DATABASE_URL: await createTestDatabase() });
    app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: false });
    return {
      projects: app.get(ProjectsService),
      flakeAnalysis: app.get(FlakeAnalysisService),
      prisma: app.get(PrismaService),
    };
  }

  it('AC-20: a Test with no Flakes shows "No Flakes recorded" (flaky: false)', async () => {
    const { projects, prisma, flakeAnalysis } = await createContext();
    const { project } = await projects.create('web-app');
    const now = new Date('2026-10-01T00:00:00Z');
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'Y',
      commitSha: 'c1'.padEnd(40, '0'),
      result: 'failed',
      receivedAt: now,
    });
    const test = await prisma.test.findFirstOrThrow({ where: { projectId: project.id } });

    const detail = await flakeAnalysis.testDetail(project.id, test.id, 14, now);

    expect(detail?.verdict).toMatchObject({ flaky: false, totalFlakes: 0, flakesInWindow: 0 });
  });

  it('AC-25: verdict counts total and in-window Flakes, history has the last 50 Commits newest first, and Flake Commits list their Outcomes with failure messages and Report metadata', async () => {
    const { projects, prisma, flakeAnalysis } = await createContext();
    const { project } = await projects.create('web-app');
    const now = new Date('2026-10-01T00:00:00Z');
    const daysAgo = (n: number): Date => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    // 58 non-flaky Commits, one per day, so the most recent 50 are within the last 50 days.
    for (let i = 0; i < 58; i++) {
      await seedOutcome(prisma, {
        projectId: project.id,
        classname: 'C',
        name: 'X',
        commitSha: `plain-${i}`.padEnd(40, '0'),
        result: 'passed',
        receivedAt: daysAgo(i + 1),
      });
    }
    // A Flake 3 days ago (within the 14-day window and within the last 50 Commits).
    const recentFlakeCommit = 'recent-flake'.padEnd(40, '0');
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'X',
      commitSha: recentFlakeCommit,
      result: 'passed',
      receivedAt: daysAgo(3),
      branch: 'main',
    });
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'X',
      commitSha: recentFlakeCommit,
      result: 'failed',
      receivedAt: daysAgo(3),
      failureMessage: 'boom',
      branch: 'main',
    });
    // A Flake 30 days ago (outside the 14-day window; outside the last 50 Commits too).
    const oldFlakeCommit = 'old-flake'.padEnd(40, '0');
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'X',
      commitSha: oldFlakeCommit,
      result: 'passed',
      receivedAt: daysAgo(30),
    });
    await seedOutcome(prisma, {
      projectId: project.id,
      classname: 'C',
      name: 'X',
      commitSha: oldFlakeCommit,
      result: 'failed',
      receivedAt: daysAgo(30),
      failureMessage: 'old boom',
    });
    const test = await prisma.test.findFirstOrThrow({
      where: { projectId: project.id, name: 'X' },
    });

    const detail = await flakeAnalysis.testDetail(project.id, test.id, 14, now);

    expect(detail?.verdict).toEqual({
      flaky: true,
      totalFlakes: 2,
      flakesInWindow: 1,
      windowDays: 14,
    });
    expect(detail?.history).toHaveLength(50);
    const receivedTimes = detail?.history.map((c) => c.outcomes[0]!.receivedAt.getTime()) ?? [];
    expect(receivedTimes).toEqual([...receivedTimes].sort((a, b) => b - a));

    const flakeCommit = detail?.history.find((c) => c.commitSha === recentFlakeCommit);
    expect(flakeCommit).toMatchObject({ isFlake: true, passed: 1, failed: 1, skipped: 0 });
    expect(flakeCommit?.outcomes).toHaveLength(2);
    expect(flakeCommit?.outcomes).toContainEqual(
      expect.objectContaining({ result: 'failed', failureMessage: 'boom', branch: 'main' }),
    );
    expect(flakeCommit?.outcomes).toContainEqual(
      expect.objectContaining({ result: 'passed', failureMessage: null, branch: 'main' }),
    );
  });

  it('SRS §10: a Test from another Project returns null', async () => {
    const { projects, prisma, flakeAnalysis } = await createContext();
    const { project: projectA } = await projects.create('web-app');
    const { project: projectB } = await projects.create('api');
    await seedOutcome(prisma, {
      projectId: projectA.id,
      classname: 'C',
      name: 'X',
      commitSha: 'a'.repeat(40),
      result: 'passed',
      receivedAt: new Date('2026-10-01T00:00:00Z'),
    });
    const test = await prisma.test.findFirstOrThrow({ where: { projectId: projectA.id } });

    const detail = await flakeAnalysis.testDetail(
      projectB.id,
      test.id,
      14,
      new Date('2026-10-01T00:00:00Z'),
    );

    expect(detail).toBeNull();
  });
});
