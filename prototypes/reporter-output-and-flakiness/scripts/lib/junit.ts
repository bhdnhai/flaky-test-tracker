import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

export interface TestCase {
  suiteFile: string; // which run-NN.xml this came from, for debugging only
  classname: string;
  name: string;
  file: string; // testcase @_file attribute, if the reporter sets one
  // testsuite @_hostname, if set. Playwright uses this for the project name
  // (e.g. "chromium"/"firefox") — notably NOT part of classname or name.
  suiteHostname: string;
  status: "pass" | "failure" | "error" | "skipped";
  raw: string; // the exact <testcase>...</testcase> snippet, for quoting
}

function arrify<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
});

// Matches both `<testcase ...>...</testcase>` and self-closing `<testcase .../>`.
const TESTCASE_RE = /<testcase\b[^>]*(?:\/>|>[\s\S]*?<\/testcase>)/g;

export function parseJUnitFile(path: string): TestCase[] {
  const xmlText = readFileSync(path, "utf8");
  const doc = parser.parse(xmlText);
  const rawSnippets = xmlText.match(TESTCASE_RE) ?? [];

  const root = doc.testsuites ?? doc;
  const suites = arrify(root.testsuite);
  const cases: TestCase[] = [];
  let rawIndex = 0;

  for (const suite of suites) {
    const suiteHostname = String(suite["@_hostname"] ?? "");
    for (const tc of arrify(suite.testcase)) {
      const classname = String(tc["@_classname"] ?? "");
      const name = String(tc["@_name"] ?? "");
      const file = String(tc["@_file"] ?? "");
      let status: TestCase["status"] = "pass";
      if ("failure" in tc) status = "failure";
      else if ("error" in tc) status = "error";
      else if ("skipped" in tc) status = "skipped";

      cases.push({
        suiteFile: path,
        classname,
        name,
        file,
        suiteHostname,
        status,
        raw: rawSnippets[rawIndex] ?? "",
      });
      rawIndex++;
    }
  }

  return cases;
}
