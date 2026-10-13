import { expect, test } from '@playwright/test';

/**
 * Runs after `npm run demo` (design §10, §11): asserts on the dashboard it already populated,
 * instead of submitting its own Reports, since the point is to exercise the exact path a
 * reviewer uses.
 */
test('AC-28: the demo Project lists every flaky fixture Test and never the always-failing one', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'demo' }).click();

  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'records two concurrent uploads in submission order' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'claims two pending Reports in submission order' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'ranks two equally-recent Flakes in submission order' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'always fails' })).toHaveCount(0);
});
