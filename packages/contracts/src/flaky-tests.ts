import { z } from 'zod';

/** One row of a Project's Flaky Tests list (FR-27). */
export const flakyTestListItemSchema = z.object({
  testId: z.uuid(),
  classname: z.string(),
  name: z.string(),
  flakeCount: z.number().int(),
  lastFlakeAt: z.iso.datetime(),
});
export type FlakyTestListItem = z.infer<typeof flakyTestListItemSchema>;

/** `GET /api/v1/projects/{projectId}/flaky-tests` (FR-23, FR-27). */
export const flakyTestsListResponseSchema = z.object({
  windowDays: z.number().int(),
  items: z.array(flakyTestListItemSchema),
});
export type FlakyTestsListResponse = z.infer<typeof flakyTestsListResponseSchema>;
