import { AxeBuilder } from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createProject } from './support/create-project.js';

const SERIOUS_OR_CRITICAL = ['serious', 'critical'];

async function assertNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter((v) => SERIOUS_OR_CRITICAL.includes(v.impact ?? ''));
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe('AC-37: axe-core reports 0 serious or critical violations', () => {
  let projectName: string;
  let testId: string;

  test.beforeAll(async ({ browser, baseURL }) => {
    projectName = `e2e-a11y-${randomUUID().slice(0, 8)}`;
    const token = await createProject(projectName);
    const page = await browser.newPage();
    const commit = 'a'.repeat(40);
    const xml = '<testsuite name="x"><testcase classname="axe" name="check" /></testsuite>';
    const res = await page.request.post(`${baseURL}/api/v1/reports?commit=${commit}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
      data: xml,
    });
    expect(res.status()).toBe(202);

    // Find the Test's id by searching, so the detail page URL can be visited directly below.
    await page.goto('/');
    await page.getByRole('link', { name: projectName }).click();
    await expect(async () => {
      await page.reload();
      await page.getByLabel('Search Tests').fill('axe');
      await expect(page.getByRole('link', { name: 'check' })).toBeVisible();
    }).toPass({ timeout: 10_000 });
    const href = await page.getByRole('link', { name: 'check' }).getAttribute('href');
    testId = href?.split('/').pop() ?? '';
    expect(testId).not.toBe('');
    await page.close();
  });

  test('Projects page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await assertNoSeriousViolations(page);
  });

  test('Flaky Tests page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: projectName }).click();
    await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();
    await assertNoSeriousViolations(page);
  });

  test('Test detail page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: projectName }).click();
    await page.getByLabel('Search Tests').fill('axe');
    await page.getByRole('link', { name: 'check' }).click();
    await expect(page.getByRole('heading', { name: 'axe > check' })).toBeVisible();
    await assertNoSeriousViolations(page);
  });

  test('Reports page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: projectName }).click();
    await page.getByRole('link', { name: 'View Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await assertNoSeriousViolations(page);
  });
});

test('AC-37: the core workflow of AC-23 can be completed with the keyboard only', async ({
  page,
  baseURL,
}) => {
  const projectName = `e2e-kbd-${randomUUID().slice(0, 8)}`;
  const token = await createProject(projectName);
  const commit = 'b'.repeat(40);
  const xml =
    '<testsuite name="x"><testcase classname="report ingestion" name="parses" /></testsuite>';
  const res = await page.request.post(`${baseURL}/api/v1/reports?commit=${commit}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
    data: xml,
  });
  expect(res.status()).toBe(202);

  await page.goto('/');
  await expect(page.getByRole('link', { name: projectName })).toBeVisible();

  // Keyboard-only path (no .click() calls below): put focus on the Project link the way a screen
  // reader user would land there (the dashboard's own Projects list can grow arbitrarily long
  // across runs, so Tab-counting from the top of the document is not what's under test here —
  // operability of the link itself is), then Enter — "unplug the mouse" per the hand-check.
  const projectLink = page.getByRole('link', { name: projectName });
  await projectLink.focus();
  await expect(projectLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();

  // The Report is processed asynchronously by the worker, so retry (reloading to refetch) until
  // the search result shows up, same as the other specs.
  const searchField = page.getByLabel('Search Tests');
  const resultLink = page.getByRole('link', { name: 'parses' });
  await expect(async () => {
    await page.reload();
    // Tab order: the header's home link, the "Projects" breadcrumb, then search.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Flaky Test Tracker' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Projects' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(searchField).toBeFocused();
    await page.keyboard.type('INGEST');
    await expect(resultLink).toBeVisible();
  }).toPass({ timeout: 10_000 });

  await expect(async () => {
    await page.keyboard.press('Tab');
    await expect(resultLink).toBeFocused();
  }).toPass({ timeout: 5_000 });
  await page.keyboard.press('Enter');

  await expect(page.getByText('No Flakes recorded')).toBeVisible();
});
