/**
 * A minimal well-formed JUnit document. Ticket 02 doesn't parse Report bodies (that's
 * ReportProcessing, ticket 03), so its content only needs to be XML-shaped.
 */
export const SAMPLE_JUNIT_XML =
  '<testsuite name="x"><testcase classname="C" name="t" /></testsuite>';
