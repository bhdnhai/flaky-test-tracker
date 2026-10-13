import react from '@vitejs/plugin-react';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// In dev, proxy API calls to a locally running api (`npm run start:dev -w apps/api`),
// mirroring the nginx proxy used in docker compose.
const apiTarget = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  // Resolve @ftt/contracts to its TypeScript source instead of its build output.
  resolve: { conditions: ['source', ...defaultClientConditions] },
  // Vitest resolves modules for Node through the SSR settings, so they need the condition too.
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  server: {
    proxy: { '/api': apiTarget, '/health': apiTarget },
  },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
