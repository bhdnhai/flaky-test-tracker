import { expect, test } from '@playwright/test';
import { racingLog } from './support/race.js';

test.describe('report ingestion', () => {
  test.describe('duplicate detection', () => {
    test('records two concurrent uploads in submission order', async ({ page }) => {
      await page.goto('about:blank');
      const log = await racingLog();
      expect(log).toEqual(['first', 'second']);
    });
  });
});
