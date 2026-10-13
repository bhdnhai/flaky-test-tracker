import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve @ftt/contracts to its TypeScript source instead of its build output.
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  test: {
    // NFR-12 / AC-39: the JUnit interpretation module needs >= 90% line coverage.
    coverage: {
      provider: 'v8',
      include: ['src/junit/**/*.ts'],
      exclude: ['src/junit/**/*.test.ts'],
      thresholds: { lines: 90 },
    },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.int.test.ts'],
          globalSetup: ['test/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
