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
}
