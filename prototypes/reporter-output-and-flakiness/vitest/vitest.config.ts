import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: __dirname,
    include: ["fixtures/**/*.test.ts"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: process.env.JUNIT_OUTPUT_FILE ?? "../runs/vitest-normal/latest.xml",
    },
    // Keep this suite single-threaded: the point is to observe the *same*
    // race on every run, not to add extra nondeterminism from the pool.
    fileParallelism: false,
  },
});
