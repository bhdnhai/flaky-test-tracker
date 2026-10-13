import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { interpret, type CollidingIdentity, type InterpretedTestCase } from '../junit/index.js';
import { PrismaService } from '../platform/index.js';
import { ReportQueueService } from './report-queue.js';

/** One Test's identity as reported (FR-14). Keyed with a separator that can't appear in either part. */
function identityKeyOf(classname: string, name: string): string {
  return `${classname}\u0000${name}`;
}

/**
 * The Report's Collision warning (FR-17, AC-14): the colliding identities plus both
 * documented fixes (ADR-0005). Which reporter produced the file is never detected, so
 * both options are always given.
 */
function collisionWarningOf(collisions: CollidingIdentity[]): Prisma.InputJsonValue | undefined {
  if (collisions.length === 0) return undefined;
  return {
    identities: collisions,
    message:
      "These test cases share a classname + name with another case in this Report, so no Outcome was recorded for them. Make identities unique: for Playwright with multiple projects, set includeProjectInTestName: true; for jest-junit, set classNameTemplate to include {filepath}.",
  } as unknown as Prisma.InputJsonValue;
}

/**
 * The worker loop's unit of work: claim → interpret → persist Tests and Outcomes
 * idempotently → complete (design §4). Happy path only (ticket 03); retry and failure
 * handling arrive with ticket 09.
 */
@Injectable()
export class ReportProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: ReportQueueService,
  ) {}

  /** Processes one claimed Report. Returns whether there was a Report to process. */
  async processNext(now: Date): Promise<boolean> {
    const startedAt = Date.now();
    const claimed = await this.queue.claimNext(now);
    if (!claimed) return false;

    const content = await this.prisma.reportContent.findUniqueOrThrow({
      where: { reportId: claimed.id },
    });
    const { cases, collisions } = interpret(Buffer.from(content.body).toString('utf-8'));

    await this.prisma.$transaction(async (tx) => {
      const testIdByIdentity = await upsertTests(tx, claimed.projectId, cases);

      if (cases.length > 0) {
        await tx.outcome.createMany({
          skipDuplicates: true, // Idempotent re-processing of the same attempt (FR-18);
          // colliding cases never reach here — `interpret` already excluded them (FR-17).
          data: cases.map((testCase) => ({
            reportId: claimed.id,
            testId: testIdByIdentity.get(identityKeyOf(testCase.classname, testCase.name))!,
            projectId: claimed.projectId,
            commitSha: claimed.commitSha,
            result: testCase.result,
            failureMessage: testCase.failureMessage,
            receivedAt: claimed.receivedAt,
          })),
        });
      }

      await this.queue.complete(tx, claimed.id, now, collisionWarningOf(collisions));
    });

    // One log line per Report state change (design §9): full observability (redaction,
    // structured pino output, NFR-10) is ticket 10's job; this is the happy-path shape.
    console.log(
      JSON.stringify({
        reportId: claimed.id,
        from: 'pending',
        to: 'processed',
        attempt: claimed.processingAttempts,
        durationMs: Date.now() - startedAt,
      }),
    );

    return true;
  }
}

/** Finds or creates each case's Test, returning its id keyed by identity (FR-14). */
async function upsertTests(
  tx: Prisma.TransactionClient,
  projectId: string,
  cases: InterpretedTestCase[],
): Promise<Map<string, string>> {
  const identities = new Map(cases.map((c) => [identityKeyOf(c.classname, c.name), c]));
  if (identities.size === 0) return new Map();

  await tx.test.createMany({
    skipDuplicates: true,
    data: [...identities.values()].map((c) => ({
      projectId,
      classname: c.classname,
      name: c.name,
    })),
  });

  const tests = await tx.test.findMany({
    where: {
      projectId,
      OR: [...identities.values()].map((c) => ({ classname: c.classname, name: c.name })),
    },
  });

  return new Map(tests.map((test) => [identityKeyOf(test.classname, test.name), test.id]));
}
