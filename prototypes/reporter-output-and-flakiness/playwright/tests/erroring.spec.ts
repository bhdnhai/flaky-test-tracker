import { test } from "@playwright/test";

test.describe("report ingestion", () => {
  test("throws while parsing a malformed report", () => {
    throw new Error("malformed report: unexpected end of XML");
  });
});
