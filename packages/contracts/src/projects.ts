import { z } from 'zod';

/** One Project, as listed on the Projects page (FR-26). */
export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
});
export type ProjectDto = z.infer<typeof projectSchema>;

/** `GET /api/v1/projects` success body, sorted by name (SRS §9.2). */
export const projectsListResponseSchema = z.object({
  items: z.array(projectSchema),
});
export type ProjectsListResponse = z.infer<typeof projectsListResponseSchema>;
