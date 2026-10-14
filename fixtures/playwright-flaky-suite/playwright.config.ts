import { defineConfig, devices } from '@playwright/test';

/**
 * Genuinely flaky fixture suite for `npm run demo:playwright` (FR-35, stretch), run across two
 * browser projects so its JUnit output needs `includeProjectInTestName` to keep each project's
 * Test identity unique (ADR-0005).
 */
export default defineConfig({
  testDir: 'tests',
  reporter: [['junit', { outputFile: 'runs/result.xml', includeProjectInTestName: true }]],
  retries: 0,
  // One race per worker, like fixtures/flaky-suite's `fileParallelism: false` (prototype A8:
  // retries and extra parallelism both distort the measured ~50% rate).
  workers: 1,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
