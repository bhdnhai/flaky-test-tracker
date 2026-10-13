import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['tests/**/*.test.ts'],
    reporters: ['default', 'junit'],
    outputFile: { junit: 'runs/result.xml' },
    // One race per process: keep this suite single-threaded so every run exercises the same
    // completion-order race, not extra nondeterminism from the pool (prototype finding A8,
    // .scratch/prototypes/reporter-output-and-flakiness/handoff-back.md).
    fileParallelism: false,
  },
});
