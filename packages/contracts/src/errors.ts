import { z } from 'zod';

/** Error codes from SRS §9.1. Every non-2xx response carries exactly one of these. */
export const errorCodeSchema = z.enum([
  'INVALID_COMMIT',
  'EMPTY_REPORT',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'REPORT_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'MALFORMED_REPORT',
  'INTERNAL_ERROR',
  'UNAVAILABLE',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** The error envelope used for every non-2xx response (SRS §9.1). */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string(),
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
