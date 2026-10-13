import { racingLog } from "../../shared/race";

describe("report ingestion", () => {
  describe("duplicate detection", () => {
    it("records two concurrent uploads in submission order", async () => {
      const log = await racingLog();
      expect(log).toEqual(["first", "second"]);
    });
  });
});
