import type { PipeTransform } from '@nestjs/common';
import type { ErrorCode } from '@ftt/contracts';
import type { ZodType } from 'zod';
import { ApiError } from './api-error.js';

/**
 * Validates one input (a query parameter, a path parameter, …) against a contracts schema,
 * raising an `ApiError` with the given code on failure (ADR-0013, design §5).
 */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: ZodType<T>,
    private readonly code: ErrorCode = 'VALIDATION_ERROR',
  ) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join('; ');
      throw new ApiError(this.code, message || 'Invalid input');
    }
    return result.data;
  }
}
