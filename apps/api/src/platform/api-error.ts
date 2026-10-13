import type { ErrorCode } from '@ftt/contracts';

/** HTTP status for each error code (SRS §9.1). */
export const statusByCode: Record<ErrorCode, number> = {
  INVALID_COMMIT: 400,
  EMPTY_REPORT: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  REPORT_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  MALFORMED_REPORT: 422,
  INTERNAL_ERROR: 500,
  UNAVAILABLE: 503,
};

/** An expected failure that the error envelope filter reports with its code and message. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
