import {
  errorEnvelopeSchema,
  flakyTestsListResponseSchema,
  healthResponseSchema,
  projectsListResponseSchema,
  reportsListResponseSchema,
  type ErrorCode,
  type FlakyTestsListResponse,
  type HealthResponse,
  type ProjectsListResponse,
  type ReportsListResponse,
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

/** FR-26: the Projects page's data. */
export function getProjects(): Promise<ProjectsListResponse> {
  return getJson('/api/v1/projects', projectsListResponseSchema);
}

/** FR-30: a Project's Reports page data. */
export function getProjectReports(projectId: string): Promise<ReportsListResponse> {
  return getJson(
    `/api/v1/projects/${encodeURIComponent(projectId)}/reports`,
    reportsListResponseSchema,
  );
}

/** FR-27: a Project's Flaky Tests page data. */
export function getFlakyTests(projectId: string): Promise<FlakyTestsListResponse> {
  return getJson(
    `/api/v1/projects/${encodeURIComponent(projectId)}/flaky-tests`,
    flakyTestsListResponseSchema,
  );
}
