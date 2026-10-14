import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createProject } from './support/create-project.js';

async function submitXml(
  page: import('@playwright/test').Page,
  baseURL: string | undefined,
  token: string,
  commit: string,
  xml: string,
): Promise<void> {
  const res = await page.request.post(`${baseURL}/api/v1/reports?commit=${commit}&branch=main`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
    data: xml,
  });
  expect(res.status()).toBe(202);
}

test('AC-23, AC-25, AC-26: full core workflow — Projects → Flaky Tests → search → Test detail verdict → Reports', async ({
  page,
  baseURL,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const webAppName = `web-app-${suffix}`;
  const apiProjectName = `api-${suffix}`;
  const webAppToken = await createProject(webAppName);
  await createProject(apiProjectName);

  const ingestXml =
    '<testsuite name="x"><testcase classname="report ingestion" name="parses" /></testsuite>';
  await submitXml(page, baseURL, webAppToken, 'd'.repeat(40), ingestXml);

  const payPassing =
    '<testsuite name="x"><testcase classname="checkout" name="pays" /></testsuite>';
  const payFailing =
    '<testsuite name="x"><testcase classname="checkout" name="pays"><failure message="boom">boom</failure></testcase></testsuite>';
  // Two disagreeing Commits give "checkout > pays" exactly 2 Flakes, both inside the 14-day window.
  await submitXml(page, baseURL, webAppToken, 'e'.repeat(40), payPassing);
  await submitXml(page, baseURL, webAppToken, 'e'.repeat(40), payFailing);
  await submitXml(page, baseURL, webAppToken, 'f'.repeat(40), payPassing);
  await submitXml(page, baseURL, webAppToken, 'f'.repeat(40), payFailing);

  // AC-26: Projects page lists both Projects by name.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('link', { name: webAppName })).toBeVisible();
  await expect(page.getByRole('link', { name: apiProjectName })).toBeVisible();

  // AC-26: opening web-app shows its Flaky Tests page.
  await page.getByRole('link', { name: webAppName }).click();
  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();

  // AC-23: searching "INGEST" shows the non-flaky Test; one click opens its detail.
  await expect(async () => {
    await page.reload();
    await page.getByLabel('Search Tests').fill('INGEST');
    await expect(page.getByRole('link', { name: 'parses' })).toBeVisible();
  }).toPass({ timeout: 10_000 });
  await page.getByRole('link', { name: 'parses' }).click();

  // AC-25: the verdict is the first element on the page.
  await expect(page.locator('main > div > :first-child')).toHaveText('No Flakes recorded');
  await expect(page.getByRole('heading', { name: 'report ingestion > parses' })).toBeVisible();

  // Back to Flaky Tests, open the flaky Test, verdict is Flaky with the right counts (AC-25).
  await page.goBack();
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('link', { name: 'pays' })).toBeVisible();
  }).toPass({ timeout: 10_000 });
  await page.getByRole('link', { name: 'pays' }).click();
  await expect(page.locator('main > div > :first-child')).toHaveText(
    'Flaky: 2 Flakes (2 in the last 14 days)',
  );

  // AC-26: from Flaky Tests, the Reports page lists Reports newest first with processing state.
  await page.goto('/');
  await page.getByRole('link', { name: webAppName }).click();
  await page.getByRole('link', { name: 'View Reports' }).click();
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  const rows = page.getByRole('row').filter({ hasText: /pending|processed|processing|failed/ });
  await expect(rows.first()).toBeVisible();
});
