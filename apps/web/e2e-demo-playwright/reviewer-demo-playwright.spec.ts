import { expect, test } from '@playwright/test';

/**
 * Runs after `npm run demo:playwright` (ticket #16): asserts on the dashboard it already
 * populated. `includeProjectInTestName` (ADR-0005) makes the chromium and firefox runs of the
 * same fixture two distinct Tests.
 */
test('AC-33: the demo Project lists the Playwright flaky fixture, one Test per browser project', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'demo' }).click();

  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: '[chromium] report ingestion › duplicate detection › records two concurrent uploads in submission order',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: '[firefox] report ingestion › duplicate detection › records two concurrent uploads in submission order',
    }),
  ).toBeVisible();
});
