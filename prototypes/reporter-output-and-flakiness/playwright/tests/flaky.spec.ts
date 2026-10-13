import { test, expect } from "@playwright/test";
import { racingLog } from "../../shared/race";

test.describe("report ingestion", () => {
  test.describe("duplicate detection", () => {
    test("records two concurrent uploads in submission order", async () => {
      const log = await racingLog();
      expect(log).toEqual(["first", "second"]);
    });
  });
});
