// `npm run perf:processing` (AC-35, NFR-02). Needs `docker compose up -d --build` already
// running. Submits 20 Reports of 1,000 test cases each, one at a time (NFR-02: "with nothing
// else queued"), and times each from submission to `processed` over the real worker loop.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const PROJECT_NAME = 'perf-processing';
const SUBMISSIONS = 20;
const CASE_COUNT = 1000;
const THRESHOLD_MS = 5000;
const PROCESSING_TIMEOUT_MS = 10_000;

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // retried below
    }
    await sleep(1000);
  }
  throw new Error(
    `API is not reachable at ${BASE_URL}/health — run 'docker compose up -d --build' first.`,
  );
}

function lastLine(text) {
  return text.trim().split('\n').at(-1).trim();
}

function createOrRotateProject(name) {
  try {
    const output = execFileSync(
      'docker',
      ['compose', 'exec', '-T', 'api', 'node', 'dist/cli.js', 'create-project', name],
      { encoding: 'utf-8' },
    );
    return lastLine(output);
  } catch (error) {
    const combined = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (!combined.includes('already exists')) throw error;
    const rotated = execFileSync(
      'docker',
      ['compose', 'exec', '-T', 'api', 'node', 'dist/cli.js', 'rotate-token', name],
      { encoding: 'utf-8' },
    );
    return lastLine(rotated);
  }
}

async function findProjectId(name) {
  const res = await fetch(`${BASE_URL}/api/v1/projects`);
  const { items } = await res.json();
  const found = items.find((item) => item.name === name);
  if (!found) throw new Error(`Project "${name}" not found via ${BASE_URL}/api/v1/projects`);
  return found.id;
}

function buildJUnitXml(count) {
  const cases = Array.from(
    { length: count },
    (_, i) => `<testcase classname="perf.processing.Suite" name="case_${i}"/>`,
  );
  return `<testsuites><testsuite name="perf-processing">${cases.join('')}</testsuite></testsuites>`;
}

function randomCommitSha() {
  return randomBytes(20).toString('hex');
}

async function waitUntilProcessed(projectId, reportId) {
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/api/v1/projects/${projectId}/reports/${reportId}`);
    const report = await res.json();
    if (report.processingState === 'processed') return;
    if (report.processingState === 'failed') {
      throw new Error(`Report ${reportId} failed to process: ${report.error}`);
    }
    await sleep(50);
  }
  throw new Error(`Report ${reportId} did not reach "processed" within ${PROCESSING_TIMEOUT_MS}ms`);
}

function percentile95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

async function main() {
  await waitForHealth();

  console.log(`Creating Project "${PROJECT_NAME}"...`);
  const token = createOrRotateProject(PROJECT_NAME);
  const projectId = await findProjectId(PROJECT_NAME);
  const body = buildJUnitXml(CASE_COUNT);

  const durationsMs = [];
  for (let i = 0; i < SUBMISSIONS; i++) {
    const startedAt = performance.now();
    const res = await fetch(
      `${BASE_URL}/api/v1/reports?commit=${randomCommitSha()}&runId=perf&runAttempt=${i + 1}&job=perf-processing`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml', Authorization: `Bearer ${token}` },
        body,
      },
    );
    if (!res.ok) throw new Error(`Submission ${i + 1} failed: HTTP ${res.status}`);
    const { id } = await res.json();
    await waitUntilProcessed(projectId, id);
    const durationMs = performance.now() - startedAt;
    durationsMs.push(durationMs);
    console.log(`submission ${i + 1}/${SUBMISSIONS}: ${durationMs.toFixed(0)} ms`);
  }

  const p95 = percentile95(durationsMs);
  const passed = p95 < THRESHOLD_MS;
  console.log(
    `AC-35: p95 = ${p95.toFixed(0)} ms (target < ${THRESHOLD_MS} ms) — ${passed ? 'PASS' : 'FAIL'}`,
  );
  process.exitCode = passed ? 0 : 1;
}

await main();
