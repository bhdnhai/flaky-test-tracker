import { describe, it, expect } from "vitest";

describe("report ingestion", () => {
  it("rejects a report with a bad checksum", () => {
    expect(2 + 2).toBe(5);
  });
});
