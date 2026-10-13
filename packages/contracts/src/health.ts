import { z } from 'zod';

/** `GET /health` success body (SRS §9.2, NFR-11). */
export const healthResponseSchema = z.object({ status: z.literal('ok') });
export type HealthResponse = z.infer<typeof healthResponseSchema>;
