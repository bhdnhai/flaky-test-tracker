import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../platform/index.js';

const flakyTestRowSchema = z.object({
  test_id: z.uuid(),
  classname: z.string(),
  name: z.string(),
  flake_count: z.number().int(),
  last_flake_at: z.date(),
});

export interface FlakyTestRow {
  testId: string;
  classname: string;
  name: string;
  flakeCount: number;
  lastFlakeAt: Date;
}

const testSearchRowSchema = z.object({
  test_id: z.uuid(),
  classname: z.string(),
  name: z.string(),
  total_flakes: z.number().int(),
});

export interface TestSearchRow {
  testId: string;
  classname: string;
  name: string;
  totalFlakes: number;
}

const flakeTotalsRowSchema = z.object({
  total_flakes: z.number().int(),
  flakes_in_window: z.number().int(),
});

const commitSummaryRowSchema = z.object({
  commit_sha: z.string(),
  passed: z.number().int(),
  failed: z.number().int(),
  skipped: z.number().int(),
});

const outcomeResultSchema = z.enum(['passed', 'failed', 'skipped']);

export interface TestDetailOutcome {
  result: 'passed' | 'failed' | 'skipped';
  failureMessage: string | null;
  reportId: string;
  branch: string | null;
  runId: string | null;
  runAttempt: number | null;
  job: string | null;
  receivedAt: Date;
}

export interface TestDetailCommit {
  commitSha: string;
  isFlake: boolean;
  passed: number;
  failed: number;
  skipped: number;
  outcomes: TestDetailOutcome[];
}

export interface TestDetail {
  testId: string;
  classname: string;
  name: string;
  verdict: {
    flaky: boolean;
    totalFlakes: number;
    flakesInWindow: number;
    windowDays: number;
  };
  history: TestDetailCommit[];
}

/** The last 50 Commits a Test ran on, newest first (FR-25). */
const HISTORY_LIMIT = 50;

/**
 * Flakes computed on read (design §6, ADR-0004, ADR-0008): a Flake is a (Test, Commit) pair
 * with at least one `passed` and at least one `failed` Outcome. One raw SQL aggregate per
 * Project, validated with Zod since Prisma doesn't type `$queryRaw` results.
 */
@Injectable()
export class FlakeAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  /** The Flaky Tests list (FR-21, FR-23), ordered by Flake count desc, last Flake desc, name asc. */
  async flakyTests(projectId: string, windowDays: number, now: Date): Promise<FlakyTestRow[]> {
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<unknown[]>`
      WITH "flakes" AS (
        SELECT "test_id", "commit_sha", MAX("received_at") AS "flake_time"
        FROM "outcome"
        WHERE "project_id" = ${projectId}
        GROUP BY "test_id", "commit_sha"
        HAVING COUNT(*) FILTER (WHERE "result" = 'passed') > 0
           AND COUNT(*) FILTER (WHERE "result" = 'failed') > 0
      )
      SELECT "t"."id" AS "test_id", "t"."classname", "t"."name",
             COUNT(*) FILTER (WHERE "f"."flake_time" >= ${windowStart})::int AS "flake_count",
             MAX("f"."flake_time") FILTER (WHERE "f"."flake_time" >= ${windowStart}) AS "last_flake_at"
      FROM "flakes" "f"
      JOIN "test" "t" ON "t"."id" = "f"."test_id"
      GROUP BY "t"."id", "t"."classname", "t"."name"
      HAVING COUNT(*) FILTER (WHERE "f"."flake_time" >= ${windowStart}) > 0
      ORDER BY "flake_count" DESC, "last_flake_at" DESC, "t"."name" ASC
    `;

    return rows.map((row) => {
      const parsed = flakyTestRowSchema.parse(row);
      return {
        testId: parsed.test_id,
        classname: parsed.classname,
        name: parsed.name,
        flakeCount: parsed.flake_count,
        lastFlakeAt: parsed.last_flake_at,
      };
    });
  }

  /**
   * Test search (FR-24): case-insensitive substring over `name` and `classname`, including
   * Tests with no Flakes, sorted by name, capped at 50, each with its all-time Flake count.
   */
  async search(projectId: string, query: string): Promise<TestSearchRow[]> {
    // `%`, `_` and `\` are literal text in a search, not LIKE wildcards (FR-24, D-03).
    const pattern = `%${escapeLikePattern(query)}%`;

    const rows = await this.prisma.$queryRaw<unknown[]>`
      WITH "matched_tests" AS (
        SELECT "id", "classname", "name"
        FROM "test"
        WHERE "project_id" = ${projectId}
          AND ("name" ILIKE ${pattern} ESCAPE '\\' OR "classname" ILIKE ${pattern} ESCAPE '\\')
        ORDER BY "name" ASC
        LIMIT 50
      ),
      "flakes" AS (
        SELECT "test_id", COUNT(*)::int AS "flake_count"
        FROM (
          SELECT "test_id", "commit_sha"
          FROM "outcome"
          WHERE "project_id" = ${projectId}
            AND "test_id" IN (SELECT "id" FROM "matched_tests")
          GROUP BY "test_id", "commit_sha"
          HAVING COUNT(*) FILTER (WHERE "result" = 'passed') > 0
             AND COUNT(*) FILTER (WHERE "result" = 'failed') > 0
        ) "f"
        GROUP BY "test_id"
      )
      SELECT "mt"."id" AS "test_id", "mt"."classname", "mt"."name",
             COALESCE("fl"."flake_count", 0)::int AS "total_flakes"
      FROM "matched_tests" "mt"
      LEFT JOIN "flakes" "fl" ON "fl"."test_id" = "mt"."id"
      ORDER BY "mt"."name" ASC
    `;

    return rows.map((row) => {
      const parsed = testSearchRowSchema.parse(row);
      return {
        testId: parsed.test_id,
        classname: parsed.classname,
        name: parsed.name,
        totalFlakes: parsed.total_flakes,
      };
    });
  }

  /**
   * Test detail (FR-25): identity, verdict and history over the last 50 Commits, newest first.
   * Returns `null` when the Test doesn't belong to the Project (SRS §10).
   */
  async testDetail(
    projectId: string,
    testId: string,
    windowDays: number,
    now: Date,
  ): Promise<TestDetail | null> {
    const test = await this.prisma.test.findFirst({ where: { id: testId, projectId } });
    if (!test) return null;

    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const [totalsRow] = await this.prisma.$queryRaw<unknown[]>`
      SELECT
        COUNT(*)::int AS "total_flakes",
        COUNT(*) FILTER (WHERE "flake_time" >= ${windowStart})::int AS "flakes_in_window"
      FROM (
        SELECT "commit_sha", MAX("received_at") AS "flake_time"
        FROM "outcome"
        WHERE "project_id" = ${projectId} AND "test_id" = ${testId}
        GROUP BY "commit_sha"
        HAVING COUNT(*) FILTER (WHERE "result" = 'passed') > 0
           AND COUNT(*) FILTER (WHERE "result" = 'failed') > 0
      ) "flakes"
    `;
    const totals = flakeTotalsRowSchema.parse(totalsRow);

    const commitRows = await this.prisma.$queryRaw<unknown[]>`
      SELECT "commit_sha",
             COUNT(*) FILTER (WHERE "result" = 'passed')::int AS "passed",
             COUNT(*) FILTER (WHERE "result" = 'failed')::int AS "failed",
             COUNT(*) FILTER (WHERE "result" = 'skipped')::int AS "skipped",
             MAX("received_at") AS "last_received_at"
      FROM "outcome"
      WHERE "project_id" = ${projectId} AND "test_id" = ${testId}
      GROUP BY "commit_sha"
      ORDER BY "last_received_at" DESC
      LIMIT ${HISTORY_LIMIT}
    `;
    const commitSummaries = commitRows.map((row) => commitSummaryRowSchema.parse(row));
    const commitShas = commitSummaries.map((commit) => commit.commit_sha);

    const outcomes = commitShas.length
      ? await this.prisma.outcome.findMany({
          where: { projectId, testId, commitSha: { in: commitShas } },
          include: { report: true },
          orderBy: { receivedAt: 'desc' },
        })
      : [];

    const outcomesByCommit = new Map<string, TestDetailOutcome[]>();
    for (const outcome of outcomes) {
      const list = outcomesByCommit.get(outcome.commitSha) ?? [];
      list.push({
        result: outcomeResultSchema.parse(outcome.result),
        failureMessage: outcome.failureMessage,
        reportId: outcome.reportId,
        branch: outcome.report.branch,
        runId: outcome.report.ciRunId,
        runAttempt: outcome.report.ciRunAttempt,
        job: outcome.report.ciJob,
        receivedAt: outcome.receivedAt,
      });
      outcomesByCommit.set(outcome.commitSha, list);
    }

    const history: TestDetailCommit[] = commitSummaries.map((commit) => ({
      commitSha: commit.commit_sha,
      isFlake: commit.passed > 0 && commit.failed > 0,
      passed: commit.passed,
      failed: commit.failed,
      skipped: commit.skipped,
      outcomes: outcomesByCommit.get(commit.commit_sha) ?? [],
    }));

    return {
      testId: test.id,
      classname: test.classname,
      name: test.name,
      verdict: {
        flaky: totals.total_flakes > 0,
        totalFlakes: totals.total_flakes,
        flakesInWindow: totals.flakes_in_window,
        windowDays,
      },
      history,
    };
  }
}

/** Escapes LIKE metacharacters so the query matches literally (FR-24, D-03). */
export function escapeLikePattern(query: string): string {
  return query.replace(/[\\%_]/g, (char) => `\\${char}`);
}
