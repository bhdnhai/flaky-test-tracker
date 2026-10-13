import {
  errorEnvelopeSchema,
  healthResponseSchema,
  type ErrorCode,
  type HealthResponse,
} from '@ftt/contracts';
import type { z } from 'zod';

/** A non-2xx response from the API, described by its error envelope (SRS §9.1). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly requestId: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  const body: unknown = await res.json();
  if (!res.ok) {
    const { error } = errorEnvelopeSchema.parse(body);
    throw new ApiRequestError(res.status, error.code, error.message, error.requestId);
  }
  return schema.parse(body);
}

export function getHealth(): Promise<HealthResponse> {
  return getJson('/health', healthResponseSchema);
}
