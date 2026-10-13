import { z } from 'zod';

/** `GET /api/v1/projects/{projectId}/tests?search=`'s query parameter (FR-24). */
export const testSearchQuerySchema = z.string().min(2).max(200);

/** One row of Test search results (FR-24). */
export const testSearchResultItemSchema = z.object({
  testId: z.uuid(),
  classname: z.string(),
  name: z.string(),
  totalFlakes: z.number().int(),
});
export type TestSearchResultItem = z.infer<typeof testSearchResultItemSchema>;

/** `GET /api/v1/projects/{projectId}/tests?search=` response (FR-24, FR-28). */
export const testSearchResponseSchema = z.object({
  items: z.array(testSearchResultItemSchema),
});
export type TestSearchResponse = z.infer<typeof testSearchResponseSchema>;

/** A Test's verdict: "Flaky" with counts, or no Flakes recorded (FR-25). */
export const testVerdictSchema = z.object({
  flaky: z.boolean(),
  totalFlakes: z.number().int(),
  flakesInWindow: z.number().int(),
  windowDays: z.number().int(),
});
export type TestVerdict = z.infer<typeof testVerdictSchema>;

/** One Outcome within a Test detail history Commit (FR-25). */
export const testDetailOutcomeSchema = z.object({
  result: z.enum(['passed', 'failed', 'skipped']),
  failureMessage: z.string().nullable(),
  reportId: z.uuid(),
  branch: z.string().nullable(),
  runId: z.string().nullable(),
  runAttempt: z.number().int().nullable(),
  job: z.string().nullable(),
  receivedAt: z.iso.datetime(),
});
export type TestDetailOutcome = z.infer<typeof testDetailOutcomeSchema>;

/** One Commit in a Test's history, newest first (FR-25). */
export const testDetailCommitSchema = z.object({
  commitSha: z.string(),
  isFlake: z.boolean(),
  passed: z.number().int(),
  failed: z.number().int(),
  skipped: z.number().int(),
  outcomes: z.array(testDetailOutcomeSchema),
});
export type TestDetailCommit = z.infer<typeof testDetailCommitSchema>;

/** `GET /api/v1/projects/{projectId}/tests/{testId}` response (FR-25, FR-29). */
export const testDetailResponseSchema = z.object({
  testId: z.uuid(),
  classname: z.string(),
  name: z.string(),
  verdict: testVerdictSchema,
  history: z.array(testDetailCommitSchema),
});
export type TestDetailResponse = z.infer<typeof testDetailResponseSchema>;
