import { z } from 'zod';

const appConfigSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

/** Injection token for the validated configuration. */
export const APP_CONFIG = Symbol('APP_CONFIG');

/** Reads and validates configuration from environment variables; throws on invalid input. */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  return appConfigSchema.parse(env);
}
