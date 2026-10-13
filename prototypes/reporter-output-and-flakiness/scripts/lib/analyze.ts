import { readdirSync } from "node:fs";
import path from "node:path";
import { parseJUnitFile, type TestCase } from "./junit";

export interface VariantResult {
  id: string;
  dir: string;
  runs: number;
}

const FLAKY_TEST_NAME = "records two concurrent uploads in submission order";

interface RunRecord {
  run: number;
  cases: TestCase[];
}

interface IdentityRow {
  classname: string;
  name: string;
  file: string;
  stableAcrossRuns: boolean;
  attemptsPerRun: number[]; // how many <testcase> entries matched this key, per run
  note: string;
}

interface FlakyRow {
  classname: string;
  name: string;
  finalStatusPerRun: Array<"pass" | "fail">;
  failRate: number;
  attemptsPerRun: number[];
}

interface VariantAnalysis {
  id: string;
  runCount: number;
  identity: IdentityRow[];
  identityFullyStable: boolean;
  samples: Record<string, { key: string; raw: string } | undefined>;
  flaky: FlakyRow[];
}

function loadRuns(dir: string, expected: number): RunRecord[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".xml"))
    .sort();
  return files.map((f, i) => ({
    run: i + 1,
    cases: parseJUnitFile(path.join(dir, f)),
  }));
}

function key(tc: Pick<TestCase, "classname" | "name">): string {
  return `${tc.classname}::${tc.name}`;
}

function analyzeVariant(result: VariantResult): VariantAnalysis {
  const runs = loadRuns(result.dir, result.runs);

  // Union of every (classname,name) key seen in any run, in first-seen order.
  const order: string[] = [];
  const seen = new Set<string>();
  for (const r of runs) {
    for (const tc of r.cases) {
      const k = key(tc);
      if (!seen.has(k)) {
        seen.add(k);
        order.push(k);
      }
    }
  }

  const identity: IdentityRow[] = order.map((k) => {
    const [classname, name] = [k.split("::")[0], k.slice(k.indexOf("::") + 2)];
    const attemptsPerRun = runs.map((r) => r.cases.filter((tc) => key(tc) === k).length);
    const presentInEveryRun = attemptsPerRun.every((n) => n > 0);
    const countStable = new Set(attemptsPerRun).size === 1;
    const file = runs[0]?.cases.find((tc) => key(tc) === k)?.file ?? "";
    let note = "";
    if (!presentInEveryRun) note = "missing from at least one run";
    else if (!countStable) note = `entry count varies per run (${attemptsPerRun.join(",")}) — likely retry attempts`;
    else if (attemptsPerRun[0] > 1)
      note = `${attemptsPerRun[0]}x per run, every run — classname+name does NOT disambiguate (likely multiple projects/workers sharing this identity)`;
    return {
      classname,
      name,
      file,
      stableAcrossRuns: presentInEveryRun && countStable,
      attemptsPerRun,
      note,
    };
  });

  // One raw <testcase> sample per status actually observed, preferring the
  // flaky test's snippets so failure/error/skip come from a readable example.
  const samples: VariantAnalysis["samples"] = {};
  for (const r of runs) {
    for (const tc of r.cases) {
      if (!samples[tc.status]) {
        samples[tc.status] = { key: key(tc), raw: tc.raw };
      }
    }
  }

  // Flaky test: group by (classname,name,suiteHostname) so that multiple
  // Playwright projects — which share the same classname+name — are
  // reported as separate tracks instead of silently overwriting each
  // other. "Final" status per run = last matching entry in that run's
  // file (authoritative result after any retries).
  const flakyGroupKey = (tc: TestCase) => `${key(tc)}::${tc.suiteHostname}`;
  const flakyGroups = new Map<string, { classname: string; hostname: string }>();
  for (const r of runs) {
    for (const tc of r.cases) {
      if (!tc.name.endsWith(FLAKY_TEST_NAME)) continue;
      flakyGroups.set(flakyGroupKey(tc), { classname: tc.classname, hostname: tc.suiteHostname });
    }
  }
  const flaky: FlakyRow[] = Array.from(flakyGroups.entries()).map(([gk, { classname, hostname }]) => {
    const finalStatusPerRun: Array<"pass" | "fail"> = [];
    const attemptsPerRun: number[] = [];
    for (const r of runs) {
      const matches = r.cases.filter((tc) => flakyGroupKey(tc) === gk);
      attemptsPerRun.push(matches.length);
      const last = matches[matches.length - 1];
      finalStatusPerRun.push(!last || last.status === "pass" ? "pass" : "fail");
    }
    const failRate = finalStatusPerRun.filter((s) => s === "fail").length / finalStatusPerRun.length;
    const label = hostname ? `${classname} [${hostname}]` : classname;
    return { classname: label, name: FLAKY_TEST_NAME, finalStatusPerRun, failRate, attemptsPerRun };
  });

  return {
    id: result.id,
    runCount: runs.length,
    identity,
    identityFullyStable: identity.every((i) => i.stableAcrossRuns),
    samples,
    flaky,
  };
}

function renderText(analyses: VariantAnalysis[]): string {
  const lines: string[] = [];
  for (const a of analyses) {
    lines.push(`\n=== ${a.id} (${a.runCount} runs) ===`);
    lines.push(`Identity stable across all runs: ${a.identityFullyStable ? "YES" : "NO"}`);
    for (const row of a.identity) {
      const flag = row.stableAcrossRuns
        ? row.note
          ? `stable, but ${row.note}`
          : "stable"
        : `UNSTABLE (${row.note})`;
      lines.push(`  - ${row.classname} :: ${row.name}${row.file ? ` [file=${row.file}]` : ""} -> ${flag}`);
    }
    for (const f of a.flaky) {
      lines.push(
        `  FLAKY "${f.name}" (${f.classname}): fail rate ${(f.failRate * 100).toFixed(0)}% ` +
          `over ${f.finalStatusPerRun.length} runs [${f.finalStatusPerRun.join(",")}]` +
          (new Set(f.attemptsPerRun).size > 1 ? ` attempts/run=[${f.attemptsPerRun.join(",")}]` : ""),
      );
    }
    lines.push(`Samples by status:`);
    for (const [status, sample] of Object.entries(a.samples)) {
      if (!sample) continue;
      lines.push(`  --- ${status} (${sample.key}) ---`);
      lines.push(
        sample.raw
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
      );
    }
  }
  return lines.join("\n");
}

function renderMarkdown(analyses: VariantAnalysis[]): string {
  const lines: string[] = ["# Raw results", ""];
  for (const a of analyses) {
    lines.push(`## ${a.id}`, "");
    lines.push(`Runs: ${a.runCount}. Identity stable across all runs: **${a.identityFullyStable ? "yes" : "no"}**.`, "");
    lines.push("| classname | name | file | stable | note |", "|---|---|---|---|---|");
    for (const row of a.identity) {
      lines.push(
        `| \`${row.classname}\` | \`${row.name}\` | \`${row.file}\` | ${row.stableAcrossRuns ? "yes" : "no"} | ${row.note} |`,
      );
    }
    lines.push("");
    if (a.flaky.length > 0) {
      lines.push("Flaky test failure rate:", "");
      lines.push("| classname | runs | fail rate | outcomes |", "|---|---|---|---|");
      for (const f of a.flaky) {
        lines.push(
          `| \`${f.classname}\` | ${f.finalStatusPerRun.length} | ${(f.failRate * 100).toFixed(0)}% | ${f.finalStatusPerRun.join(", ")} |`,
        );
      }
      lines.push("");
    }
    lines.push("<details><summary>Raw testcase samples</summary>", "");
    for (const [status, sample] of Object.entries(a.samples)) {
      if (!sample) continue;
      lines.push(`**${status}** (\`${sample.key}\`):`, "", "```xml", sample.raw, "```", "");
    }
    lines.push("</details>", "");
  }
  return lines.join("\n");
}

export function analyze(results: VariantResult[]): { text: string; markdown: string; json: unknown } {
  const analyses = results.map(analyzeVariant);
  return {
    text: renderText(analyses),
    markdown: renderMarkdown(analyses),
    json: analyses,
  };
}
