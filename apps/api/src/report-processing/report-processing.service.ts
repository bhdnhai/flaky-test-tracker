import { Injectable, Logger } from '@nestjs/common';
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
 * idempotently → complete or fail (design §4, FR-18, FR-19).
 */
@Injectable()
export class ReportProcessingService {
  private readonly logger = new Logger(ReportProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: ReportQueueService,
  ) {}

  /** Processes one claimed Report. Returns whether there was a Report to process. */
  async processNext(now: Date): Promise<boolean> {
    const startedAt = Date.now();
    const claimed = await this.queue.claimNext(now);
    if (!claimed) return false;

    try {
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

      // One log line per Report state change (design §9, NFR-10).
      this.logger.log({
        reportId: claimed.id,
        from: 'pending',
        to: 'processed',
        attempt: claimed.processingAttempts,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      // A poison Report (parseable root, unreadable test cases) must not crash the
      // worker (NFR-05): the attempt is recorded and the Report retried or failed (FR-19).
      const message = error instanceof Error ? error.message : String(error);
      await this.queue.fail(claimed.id, message, claimed.processingAttempts, now);
      this.logger.log({
        reportId: claimed.id,
        from: 'pending',
        to: 'processing-failed',
        attempt: claimed.processingAttempts,
        error: message,
        durationMs: Date.now() - startedAt,
      });
    }

    return true;
  }

  /**
   * Releases claims that have sat in `processing` past the 60 s claim window — a worker
   * was killed mid-attempt — so the Report can be retried or marked `failed` (NFR-04).
   * Called on a timer from the worker entry point.
   */
  async sweep(now: Date): Promise<void> {
    const releasedCount = await this.queue.releaseExpired(now);
    if (releasedCount > 0) {
      this.logger.log({ event: 'claims-released', count: releasedCount });
    }
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
