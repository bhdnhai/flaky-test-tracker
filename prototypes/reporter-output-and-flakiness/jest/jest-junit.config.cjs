// Env vars JEST_JUNIT_OUTPUT_DIR / JEST_JUNIT_OUTPUT_NAME (set by
// scripts/run.ts) override these defaults, which only apply to ad-hoc
// `npm run test:jest` invocations.
module.exports = {
  outputDirectory: "runs/jest-normal",
  outputName: "latest.xml",
};
