import { defineConfig } from '@playwright/test';

/**
 * Verifies `npm run demo:playwright` (ticket #16, FR-35, AC-33). Kept out of `playwright.config.ts`'s
 * `e2e` testDir so this spec doesn't join the default `npm run test:e2e` sweep CI runs right
 * after plain `npm run demo` (that CI step never runs `npm run demo:playwright`).
 */
export default defineConfig({
  testDir: 'e2e-demo-playwright',
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
});
