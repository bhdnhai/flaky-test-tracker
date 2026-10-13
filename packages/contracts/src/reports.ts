import { z } from 'zod';

/** Report processing lifecycle (SRS §8). */
export const processingStateSchema = z.enum(['pending', 'processing', 'processed', 'failed']);
export type ProcessingState = z.infer<typeof processingStateSchema>;

/**
 * `commit`: required, 40 or 64 hexadecimal characters, case-insensitive, stored lowercase
 * (FR-07, AC-06).
 */
export const commitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$|^[0-9a-f]{64}$/i)
  .transform((value) => value.toLowerCase());

/** Optional Report metadata, stored as received (FR-08, AC-07). */
export const submitReportMetadataSchema = z.object({
  branch: z.string().max(255).optional(),
  runId: z.string().max(64).optional(),
  runAttempt: z.coerce.number().int().min(1).optional(),
  job: z.string().max(255).optional(),
});
export type SubmitReportMetadata = z.infer<typeof submitReportMetadataSchema>;

/** `POST /api/v1/reports` success body (SRS §9.2). */
export const submitReportResponseSchema = z.object({
  id: z.uuid(),
  processingState: processingStateSchema,
  duplicate: z.boolean(),
});
export type SubmitReportResponse = z.infer<typeof submitReportResponseSchema>;

/** One row of a Project's Reports page (FR-30). */
export const reportListItemSchema = z.object({
  id: z.uuid(),
  commitSha: z.string(),
  branch: z.string().nullable(),
  runId: z.string().nullable(),
  runAttempt: z.number().int().nullable(),
  job: z.string().nullable(),
  sizeBytes: z.number().int(),
  processingState: processingStateSchema,
  error: z.string().nullable(),
  collisionWarning: z.unknown().nullable(),
  receivedAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
});
export type ReportListItem = z.infer<typeof reportListItemSchema>;

/** `GET /api/v1/projects/{projectId}/reports` and the single-Report read (SRS §9.2). */
export const reportsListResponseSchema = z.object({
  items: z.array(reportListItemSchema),
});
export type ReportsListResponse = z.infer<typeof reportsListResponseSchema>;
