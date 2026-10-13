import { expect, test } from '@playwright/test';

test('NFR-13: the dashboard served by docker compose shows the API status as ok', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('status')).toHaveText('API: ok');
});
