const path = require("node:path");

/** @type {import('jest').Config} */
module.exports = {
  // rootDir is the prototype root (not jest/) so that Jest's transform
  // also covers ../shared/race.ts, which the flaky fixture imports.
  rootDir: path.resolve(__dirname, ".."),
  testEnvironment: "node",
  testMatch: ["<rootDir>/jest/fixtures/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "babel-jest",
      {
        presets: [["@babel/preset-typescript", {}]],
        plugins: ["@babel/plugin-transform-modules-commonjs"],
      },
    ],
  },
  reporters: ["default", "jest-junit"],
  // jest-junit reads JEST_JUNIT_OUTPUT_DIR / JEST_JUNIT_OUTPUT_NAME from the
  // environment, which is how the harness in scripts/run.ts parameterises
  // the output path per run. Defaults here only matter for ad-hoc `npm run
  // test:jest` invocations.
};
