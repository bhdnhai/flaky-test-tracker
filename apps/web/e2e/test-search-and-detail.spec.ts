import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const execFileAsync = promisify(execFile);

/** Creates a Project through the real Operator CLI, exactly as the ticket's hand-check does. */
async function createProject(name: string): Promise<string> {
  const { stdout } = await execFileAsync('docker', [
    'compose',
    'exec',
    '-T',
    'api',
    'node',
    'dist/cli.js',
    'create-project',
    name,
  ]);
  const token = stdout.trim().split('\n').pop();
  if (!token) throw new Error(`create-project ${name} printed no token`);
  return token;
}

test('AC-23: typing a Test name into search and clicking the result opens its detail showing "No Flakes recorded"', async ({
  page,
  baseURL,
}) => {
  const projectName = `e2e-search-${randomUUID().slice(0, 8)}`;
  const token = await createProject(projectName);
  const commit = 'd'.repeat(40);
  const xml =
    '<testsuite name="x"><testcase classname="report ingestion" name="parses" /></testsuite>';

  const submitRes = await page.request.post(`${baseURL}/api/v1/reports?commit=${commit}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
    data: xml,
  });
  expect(submitRes.status()).toBe(202);

  await page.goto('/');
  await page.getByRole('link', { name: projectName }).click();
  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();

  // One click from the search result opens the Test's detail page (AC-23, G2). The Report is
  // processed asynchronously by the worker, so retry (reloading to refetch) until it shows up.
  await expect(async () => {
    await page.reload();
    await page.getByLabel('Search Tests').fill('INGEST');
    await expect(page.getByRole('link', { name: 'parses' })).toBeVisible();
  }).toPass({ timeout: 10_000 });
  await page.getByRole('link', { name: 'parses' }).click();

  await expect(page.getByText('No Flakes recorded')).toBeVisible();
});
