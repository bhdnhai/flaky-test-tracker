describe("report ingestion", () => {
  it("throws while parsing a malformed report", () => {
    throw new Error("malformed report: unexpected end of XML");
  });
});
