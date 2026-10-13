import { describe, expect, it } from 'vitest';
import { racingLog } from './support/race.js';

describe('report ingestion', () => {
  describe('duplicate detection', () => {
    it('records two concurrent uploads in submission order', async () => {
      const log = await racingLog();
      expect(log).toEqual(['first', 'second']);
    });
  });
});
