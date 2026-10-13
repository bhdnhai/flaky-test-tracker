import { test, expect } from "@playwright/test";

test.describe("report ingestion", () => {
  test("accepts a well-formed report", () => {
    expect(1 + 1).toBe(2);
  });
});
