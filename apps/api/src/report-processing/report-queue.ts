import { Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/index.js';
import { Prisma } from '../generated/prisma/client.js';

export interface ClaimedReport {
  id: string;
  projectId: string;
  commitSha: string;
  receivedAt: Date;
  processingAttempts: number;
}

interface ClaimedReportRow {
  id: string;
  project_id: string;
  commit_sha: string;
  received_at: Date;
  processing_attempts: number;
}

/**
 * The Report lifecycle as a queue (design §4, ADR-0011): the `report` table is the job.
 * This ticket covers only the happy path — `claimNext` and `complete`. Retry, back-off,
 * claim expiry and `failed` are ticket 09's `fail`/`releaseExpired`.
 */
@Injectable()
export class ReportQueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Claims the oldest due `pending` Report, or null if there is none. One atomic statement
   * (`UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED) RETURNING`), so several
   * workers can run without double-claiming (ADR-0011).
   */
  async claimNext(now: Date): Promise<ClaimedReport | null> {
    const rows = await this.prisma.$queryRaw<ClaimedReportRow[]>`
      UPDATE "report"
      SET "processing_state" = 'processing',
          "claimed_at" = ${now},
          "processing_attempts" = "processing_attempts" + 1
      WHERE "id" = (
        SELECT "id" FROM "report"
        WHERE "processing_state" = 'pending'
          AND ("next_attempt_at" IS NULL OR "next_attempt_at" <= ${now})
        ORDER BY "received_at" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id", "project_id", "commit_sha", "received_at", "processing_attempts"
    `;

    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      commitSha: row.commit_sha,
      receivedAt: row.received_at,
      processingAttempts: row.processing_attempts,
    };
  }

  /** Marks a claimed Report `processed`. Called inside the processing transaction. */
  complete(tx: Prisma.TransactionClient, reportId: string, now: Date): Promise<unknown> {
    return tx.report.update({
      where: { id: reportId },
      data: { processingState: 'processed', processedAt: now },
    });
  }
}
