import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createProject } from './support/create-project.js';

const SAMPLE_XML = '<testsuite name="x"><testcase classname="C" name="t" /></testsuite>';

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
  // AC-26/D-09: the worker may already have processed the Report by the time this runs, so
  // wait for the terminal state instead of asserting the transient `pending` one.
  await expect(async () => {
    await page.reload();
    await expect(row).toContainText('processed');
  }).toPass({ timeout: 10_000 });
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

test("FR-30 / D-02: the Reports page shows a Collision's identity and the reporter option that fixes it", async ({
  page,
  baseURL,
}) => {
  const projectName = `e2e-collision-${randomUUID().slice(0, 8)}`;
  const token = await createProject(projectName);
  const commit = 'c'.repeat(40);
  const twoProjectReport =
    '<testsuites>' +
    '<testsuite name="spec" hostname="chromium"><testcase classname="spec.ts" name="t" /></testsuite>' +
    '<testsuite name="spec" hostname="firefox"><testcase classname="spec.ts" name="t"><failure message="x">boom</failure></testcase></testsuite>' +
    '</testsuites>';

  const submitRes = await page.request.post(`${baseURL}/api/v1/reports?commit=${commit}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
    data: twoProjectReport,
  });
  expect(submitRes.status()).toBe(202);

  await page.goto('/');
  await page.getByRole('link', { name: projectName }).click();
  await page.getByRole('link', { name: 'View Reports' }).click();

  const row = page.getByRole('row', { name: new RegExp(commit.slice(0, 7)) });
  await expect(async () => {
    await page.reload();
    await expect(row).toContainText('processed');
  }).toPass({ timeout: 10_000 });
  await expect(row).toContainText('spec.ts > t');
  await expect(row).toContainText('includeProjectInTestName');
});
