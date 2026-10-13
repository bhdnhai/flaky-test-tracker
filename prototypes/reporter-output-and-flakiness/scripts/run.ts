#!/usr/bin/env tsx
// THROWAWAY harness. Runs each fixture suite N times, keeps every JUnit XML
// file it produces, then analyzes them. See ../README.md for the question
// this answers and what the output means.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, type VariantResult } from "./lib/analyze";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function argValue(flag: string, fallback: string): string {
  const prefix = `--${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const RUNS = Number(argValue("runs", "10"));
const CONCURRENCY = Number(argValue("concurrency", "4"));
const LABEL = argValue("label", "host");
const RUNS_DIR = path.join(ROOT, "runs", LABEL);

const BIN = (name: string) => path.join(ROOT, "node_modules", ".bin", name);

interface Variant {
  id: string;
  cmd: string;
  args: string[];
  env(outFile: string): NodeJS.ProcessEnv;
}

const variants: Variant[] = [
  {
    id: "vitest-normal",
    cmd: BIN("vitest"),
    args: ["run", "--config", "vitest/vitest.config.ts"],
    env: (outFile) => ({ JUNIT_OUTPUT_FILE: outFile }),
  },
  {
    id: "vitest-retry",
    cmd: BIN("vitest"),
    args: ["run", "--config", "vitest/vitest.config.ts", "--retry=2"],
    env: (outFile) => ({ JUNIT_OUTPUT_FILE: outFile }),
  },
  {
    id: "playwright-normal",
    cmd: BIN("playwright"),
    args: ["test", "--config", "playwright/playwright.config.ts"],
    env: (outFile) => ({ JUNIT_OUTPUT_FILE: outFile }),
  },
  {
    id: "playwright-retry",
    cmd: BIN("playwright"),
    args: ["test", "--config", "playwright/playwright.config.ts", "--retries=2"],
    env: (outFile) => ({ JUNIT_OUTPUT_FILE: outFile }),
  },
  {
    id: "jest-normal",
    cmd: BIN("jest"),
    args: ["--config", "jest/jest.config.cjs"],
    env: (outFile) => ({
      JEST_JUNIT_OUTPUT_DIR: path.dirname(outFile),
      JEST_JUNIT_OUTPUT_NAME: path.basename(outFile),
    }),
  },
];

function runOnce(variant: Variant, outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(outFile), { recursive: true });
    const child = spawn(variant.cmd, variant.args, {
      cwd: ROOT,
      env: { ...process.env, ...variant.env(outFile), CI: "1" },
      stdio: "ignore",
    });
    child.on("error", reject);
    // Exit code is expected to be non-zero (we deliberately have failing/
    // erroring tests) — we only care whether the XML file was produced.
    child.on("exit", () => resolve());
  });
}

async function pooled<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function main() {
  console.log(`Running ${variants.length} suite variants x ${RUNS} runs each (concurrency=${CONCURRENCY}, label=${LABEL})`);
  if (existsSync(RUNS_DIR)) rmSync(RUNS_DIR, { recursive: true, force: true });

  const started = Date.now();
  const jobs: Array<{ variant: Variant; run: number; outFile: string }> = [];
  for (const variant of variants) {
    for (let run = 1; run <= RUNS; run++) {
      const outFile = path.join(RUNS_DIR, variant.id, `run-${String(run).padStart(2, "0")}.xml`);
      jobs.push({ variant, run, outFile });
    }
  }

  await pooled(jobs, CONCURRENCY, async (job) => {
    await runOnce(job.variant, job.outFile);
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`All ${jobs.length} suite executions finished in ${elapsed}s\n`);

  const results: VariantResult[] = variants.map((v) => ({
    id: v.id,
    dir: path.join(RUNS_DIR, v.id),
    runs: RUNS,
  }));

  const report = analyze(results);
  console.log(report.text);

  const summaryDir = path.join(RUNS_DIR);
  mkdirSync(summaryDir, { recursive: true });
  writeFileSync(path.join(summaryDir, "summary.json"), JSON.stringify(report.json, null, 2));
  writeFileSync(path.join(summaryDir, "summary.md"), report.markdown);
  console.log(`Summary written to ${path.relative(ROOT, summaryDir)}/summary.{json,md}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
