// `npm run perf:reads` (AC-36, NFR-03, A10, design §6). Self-contained: seeds 10,000 Tests and
// 200,000 Outcomes straight into a disposable Postgres (ADR-0010's Testcontainers, not the
// Compose database), starts the real API against it, then times 100 requests to each read
// endpoint. Needs `apps/api` already built (`npm run build --workspace apps/api`).
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

const TEST_COUNT = 10_000;
const COMMITS = 10;
const RUNS_PER_COMMIT = 2; // 10,000 Tests x 10 Commits x 2 runs = 200,000 Outcomes (AC-36)
const FLAKE_EVERY_NTH_TEST = 7; // a realistic flake density to exercise the HAVING clause (A10)
const REQUESTS_PER_ENDPOINT = 100;
const THRESHOLD_MS = 500;
const API_PORT = 4100;

function percentile95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

async function seed(client) {
  const projectId = randomUUID();
  await client.query(
    `INSERT INTO "project" (id, name, upload_token_hash, token_rotated_at)
     VALUES ($1, $2, $3, now())`,
    [projectId, 'perf-reads', randomBytes(32).toString('hex')],
  );

  const now = Date.now();
  const reports = [];
  for (let c = 0; c < COMMITS; c++) {
    const commitSha = randomBytes(20).toString('hex');
    for (let r = 0; r < RUNS_PER_COMMIT; r++) {
      reports.push({
        id: randomUUID(),
        commitIndex: c,
        runIndex: r,
        commitSha,
        contentHash: `seed-${c}-${r}`,
        receivedAt: new Date(now - (COMMITS - c) * 60_000),
      });
    }
  }
  await client.query(
    `INSERT INTO "report"
       (id, project_id, commit_sha, content_hash, size_bytes, processing_state, received_at, processed_at)
     SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::int[], $6::text[], $7::timestamptz[], $8::timestamptz[])`,
    [
      reports.map((r) => r.id),
      reports.map(() => projectId),
      reports.map((r) => r.commitSha),
      reports.map((r) => r.contentHash),
      reports.map(() => 1024),
      reports.map(() => 'processed'),
      reports.map((r) => r.receivedAt),
      reports.map((r) => r.receivedAt),
    ],
  );

  const tests = Array.from({ length: TEST_COUNT }, (_, i) => ({
    id: randomUUID(),
    name: `case_${i}`,
  }));
  await client.query(
    `INSERT INTO "test" (id, project_id, classname, name)
     SELECT id, $2::uuid, 'perf.reads.Suite', name FROM UNNEST($1::uuid[], $3::text[]) AS u(id, name)`,
    [tests.map((t) => t.id), projectId, tests.map((t) => t.name)],
  );

  for (const report of reports) {
    const ids = [];
    const testIds = [];
    const results = [];
    for (const [testIndex, test] of tests.entries()) {
      const isFlaky = testIndex % FLAKE_EVERY_NTH_TEST === 0;
      const flips = isFlaky && report.commitIndex === 0 && report.runIndex === 1;
      ids.push(randomUUID());
      testIds.push(test.id);
      results.push(flips ? 'failed' : 'passed');
    }
    await client.query(
      `INSERT INTO "outcome" (id, report_id, test_id, project_id, commit_sha, result, received_at)
       SELECT u.id, $2::uuid, u.test_id, $3::uuid, $4::text, u.result, $5::timestamptz
       FROM UNNEST($1::uuid[], $6::uuid[], $7::text[]) AS u(id, test_id, result)`,
      [ids, report.id, projectId, report.commitSha, report.receivedAt, testIds, results],
    );
  }

  return { projectId, testId: tests[0].id, searchTerm: 'case_1' };
}

async function waitForHealth(baseUrl, server) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (server.exitCode !== null) {
      throw new Error(`API process exited early with code ${server.exitCode}`);
    }
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // retried below
    }
    await sleep(500);
  }
  throw new Error(`API did not become healthy at ${baseUrl}/health within 15s`);
}

async function timeRequests(url) {
  const durationsMs = [];
  for (let i = 0; i < REQUESTS_PER_ENDPOINT; i++) {
    const startedAt = performance.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
    await res.json();
    durationsMs.push(performance.now() - startedAt);
  }
  return percentile95(durationsMs);
}

async function main() {
  console.log('Starting a disposable Postgres (Testcontainers)...');
  const container = await new PostgreSqlContainer('postgres:18-alpine').start();
  const databaseUrl = container.getConnectionUri();
  let server;

  try {
    console.log('Running migrations against it...');
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: 'apps/api',
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    let seeded;
    try {
      console.log(
        `Seeding ${TEST_COUNT} Tests and ${TEST_COUNT * COMMITS * RUNS_PER_COMMIT} Outcomes...`,
      );
      seeded = await seed(client);
    } finally {
      await client.end();
    }

    console.log('Starting the API against the seeded database...');
    const baseUrl = `http://localhost:${API_PORT}`;
    server = spawn('node', ['dist/main.js'], {
      cwd: 'apps/api',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PORT: String(API_PORT),
        RANKING_WINDOW_DAYS: '90',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let serverOutput = '';
    server.stdout.on('data', (chunk) => (serverOutput += chunk));
    server.stderr.on('data', (chunk) => (serverOutput += chunk));

    try {
      await waitForHealth(baseUrl, server);
    } catch (error) {
      console.error(serverOutput);
      throw error;
    }

    const results = {
      'AC-36: Flaky Tests list': await timeRequests(
        `${baseUrl}/api/v1/projects/${seeded.projectId}/flaky-tests`,
      ),
      'AC-36: Test search': await timeRequests(
        `${baseUrl}/api/v1/projects/${seeded.projectId}/tests?search=${seeded.searchTerm}`,
      ),
      'AC-36: Test detail': await timeRequests(
        `${baseUrl}/api/v1/projects/${seeded.projectId}/tests/${seeded.testId}`,
      ),
    };

    let allPassed = true;
    for (const [label, p95] of Object.entries(results)) {
      const passed = p95 < THRESHOLD_MS;
      allPassed = allPassed && passed;
      console.log(
        `${label}: p95 = ${p95.toFixed(0)} ms (target < ${THRESHOLD_MS} ms) — ${passed ? 'PASS' : 'FAIL'}`,
      );
    }
    process.exitCode = allPassed ? 0 : 1;
  } finally {
    server?.kill('SIGTERM');
    await container.stop();
  }
}

await main();
