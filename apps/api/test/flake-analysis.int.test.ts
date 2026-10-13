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

describe('FlakeAnalysisService.flakyTests (FR-21, FR-22, FR-23)', () => {
  let app: INestApplicationContext | undefined;

  afterEach(async () => {
    await app?.close();
  });

  interface Context {
    projects: ProjectsService;
    flakeAnalysis: FlakeAnalysisService;
    prisma: PrismaService;
  }

  async function createContext(): Promise<Context> {
    const config = loadConfig({ DATABASE_URL: await createTestDatabase() });
    app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: false });
    return {
      projects: app.get(ProjectsService),
      flakeAnalysis: app.get(FlakeAnalysisService),
      prisma: app.get(PrismaService),
    };
  }

  /** Seeds one Outcome, creating its Test and a throwaway Report to satisfy the FK. */
  async function seedOutcome(
    prisma: PrismaService,
    opts: {
      projectId: string;
      classname: string;
      name: string;
      commitSha: string;
      result: Result;
      receivedAt: Date;
    },
  ): Promise<void> {
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
      },
    });
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
