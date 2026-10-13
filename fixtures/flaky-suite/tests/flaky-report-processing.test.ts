import { describe, expect, it } from 'vitest';
import { racingLog } from './support/race.js';

describe('report processing', () => {
  describe('worker pickup', () => {
    it('claims two pending Reports in submission order', async () => {
      const log = await racingLog();
      expect(log).toEqual(['first', 'second']);
    });
  });
});
