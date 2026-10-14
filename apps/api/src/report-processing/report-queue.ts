import { Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/index.js';
import { Prisma } from '../generated/prisma/client.js';
import { ReportNotFoundError, ReportNotReprocessableError } from './report-queue.errors.js';

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

/** Caps a stored error to a reasonable size; never splits a UTF-8 character. */
const MAX_ERROR_BYTES = 1024;

function truncateUtf8(message: string, maxBytes: number): string {
  const buffer = Buffer.from(message, 'utf-8');
  if (buffer.byteLength <= maxBytes) return message;

  let end = maxBytes;
  while (end > 0 && (buffer[end]! & 0xc0) === 0x80) end--;
  return buffer.subarray(0, end).toString('utf-8');
}

/**
 * The Report lifecycle as a queue (design §4, ADR-0011): the `report` table is the job.
 * All lifecycle rules live here: claim, complete, retry with back-off, claim expiry and
 * `failed` (SRS §8 transition table).
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

  /**
   * Marks a claimed Report `processed`. Called inside the processing transaction.
   * `collisionWarning` (FR-17) is set when given, left untouched otherwise.
   */
  complete(
    tx: Prisma.TransactionClient,
    reportId: string,
    now: Date,
    collisionWarning?: Prisma.InputJsonValue,
  ): Promise<unknown> {
    return tx.report.update({
      where: { id: reportId },
      data: {
        processingState: 'processed',
        processedAt: now,
        // A Report that failed an earlier attempt must not keep showing that error (D-02).
        error: null,
        ...(collisionWarning !== undefined ? { collisionWarning } : {}),
      },
    });
  }

  /**
   * Records a failed processing attempt (FR-19, NFR-05, SRS §8). Back to `pending` with
   * an exponential back-off while `attempts` (the claim that led to this attempt already
   * incremented it) is below 3; `failed` with the error otherwise.
   */
  async fail(reportId: string, error: string, attempts: number, now: Date): Promise<void> {
    const truncated = truncateUtf8(error, MAX_ERROR_BYTES);
    const retrying = attempts < 3;
    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        processingState: retrying ? 'pending' : 'failed',
        nextAttemptAt: retrying ? new Date(now.getTime() + 2 ** attempts * 1000) : null,
        claimedAt: null,
        error: truncated,
      },
    });
  }

  /**
   * Returns claims older than 60 s to `pending` (immediately reclaimable), or to `failed`
   * when the claim that expired was the 3rd attempt (NFR-04, SRS §8). A killed worker's
   * claim is released this way, without waiting on the worker to come back.
   */
  /**
   * Returns a `processed` or `failed` Report to `pending` with its attempts reset
   * (FR-20, SRS §8), for `reprocess-report <reportId>` (Operator CLI). Re-processing is
   * idempotent (FR-18): `ReportProcessingService.processNext` skips Outcomes already
   * recorded.
   */
  async requeue(reportId: string): Promise<void> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { processingState: true },
    });
    if (!report) throw new ReportNotFoundError(reportId);
    if (report.processingState !== 'processed' && report.processingState !== 'failed') {
      throw new ReportNotReprocessableError(reportId, report.processingState);
    }

    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        processingState: 'pending',
        processingAttempts: 0,
        claimedAt: null,
        nextAttemptAt: null,
        error: null,
        processedAt: null,
      },
    });
  }

  async releaseExpired(now: Date): Promise<number> {
    const claimCutoff = new Date(now.getTime() - 60_000);
    return this.prisma.$executeRaw`
      UPDATE "report"
      SET "processing_state" = CASE WHEN "processing_attempts" < 3 THEN 'pending' ELSE 'failed' END,
          "next_attempt_at" = NULL,
          "claimed_at" = NULL,
          "error" = CASE WHEN "processing_attempts" >= 3
            THEN 'Claim expired after 60s without completing (worker likely crashed or was killed)'
            ELSE "error" END
      WHERE "processing_state" = 'processing'
        AND "claimed_at" < ${claimCutoff}
    `;
  }
}
