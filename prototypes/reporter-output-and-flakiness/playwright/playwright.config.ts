import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["junit", { outputFile: process.env.JUNIT_OUTPUT_FILE ?? "../runs/playwright-normal/latest.xml" }],
  ],
  // None of these tests request the `page`/`browser` fixture, so no browser
  // is ever launched. Two projects purely to observe how the JUnit reporter
  // encodes project identity when the same spec runs twice.
  projects: [
    { name: "chromium", use: {} },
    { name: "firefox", use: {} },
  ],
});
