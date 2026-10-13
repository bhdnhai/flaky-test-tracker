import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createProject } from './support/create-project.js';

const XSS_NAME = '<img src=x onerror=alert(1)>';

test('AC-27: a Test named with an HTML payload renders as literal text and no script runs', async ({
  page,
  baseURL,
}) => {
  const projectName = `e2e-xss-${randomUUID().slice(0, 8)}`;
  const token = await createProject(projectName);
  const commit = 'c'.repeat(40);
  // Disagreeing Outcomes on the same Commit make the Test flaky, so it appears on the Flaky
  // Tests ranked table as well as in search and on its own detail page.
  const passingXml = `<testsuite name="x"><testcase classname="security" name="${XSS_NAME}" /></testsuite>`;
  const failingXml = `<testsuite name="x"><testcase classname="security" name="${XSS_NAME}"><failure message="boom">boom</failure></testcase></testsuite>`;

  for (const body of [passingXml, failingXml]) {
    const res = await page.request.post(`${baseURL}/api/v1/reports?commit=${commit}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
      data: body,
    });
    expect(res.status()).toBe(202);
  }

  // If the payload ever executed instead of rendering as text, this would fire and fail the test.
  page.on('dialog', (dialog) => {
    throw new Error(`Unexpected dialog (XSS payload executed): ${dialog.message()}`);
  });

  await page.goto('/');
  await page.getByRole('link', { name: projectName }).click();
  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();

  const flakyLink = page.getByRole('link', { name: XSS_NAME, exact: true });
  await expect(async () => {
    await page.reload();
    await expect(flakyLink).toBeVisible();
  }).toPass({ timeout: 10_000 });

  await page.getByLabel('Search Tests').fill('security');
  await expect(page.getByRole('link', { name: XSS_NAME, exact: true })).toBeVisible();

  await flakyLink.click();
  await expect(page.getByRole('heading', { name: `security > ${XSS_NAME}` })).toBeVisible();
});
