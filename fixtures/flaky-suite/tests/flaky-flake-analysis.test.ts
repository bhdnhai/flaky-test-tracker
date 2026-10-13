import { describe, expect, it } from 'vitest';
import { racingLog } from './support/race.js';

describe('flake analysis', () => {
  describe('ranking', () => {
    it('ranks two equally-recent Flakes in submission order', async () => {
      const log = await racingLog();
      expect(log).toEqual(['first', 'second']);
    });
  });
});
