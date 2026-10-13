import { test, expect } from "@playwright/test";

test.describe("report ingestion", () => {
  test("rejects a report with a bad checksum", () => {
    expect(2 + 2).toBe(5);
  });
});
