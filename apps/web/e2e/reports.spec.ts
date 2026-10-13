import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const execFileAsync = promisify(execFile);
const SAMPLE_XML = '<testsuite name="x"><testcase classname="C" name="t" /></testsuite>';

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

test('AC-26: Projects → Reports shows a submitted Report (the part that does not need Flaky Tests)', async ({
  page,
  baseURL,
}) => {
  const projectName = `e2e-reports-${randomUUID().slice(0, 8)}`;
  const token = await createProject(projectName);
  const commit = 'a'.repeat(40);

  const submitRes = await page.request.post(
    `${baseURL}/api/v1/reports?commit=${commit}&branch=main`,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
      data: SAMPLE_XML,
    },
  );
  expect(submitRes.status()).toBe(202);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await page.getByRole('link', { name: projectName }).click();

  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();
  await page.getByRole('link', { name: 'View Reports' }).click();

  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(commit.slice(0, 7)) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('main');
  await expect(row).toContainText('pending');
});

test('AC-26: Flaky Tests page lists a Test after two submissions on the same Commit disagree', async ({
  page,
  baseURL,
}) => {
  const projectName = `e2e-flaky-${randomUUID().slice(0, 8)}`;
  const token = await createProject(projectName);
  const commit = 'b'.repeat(40);
  const passingXml = '<testsuite name="x"><testcase classname="C" name="flaky" /></testsuite>';
  const failingXml =
    '<testsuite name="x"><testcase classname="C" name="flaky"><failure message="boom">boom</failure></testcase></testsuite>';

  for (const body of [passingXml, failingXml]) {
    const res = await page.request.post(`${baseURL}/api/v1/reports?commit=${commit}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
      data: body,
    });
    expect(res.status()).toBe(202);
  }

  await page.goto('/');
  await page.getByRole('link', { name: projectName }).click();
  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('link', { name: 'flaky' })).toBeVisible();
    const row = page.getByRole('row', { name: /flaky/ });
    await expect(row).toContainText('1');
  }).toPass({ timeout: 10_000 });
});
