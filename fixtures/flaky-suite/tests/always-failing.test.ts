import { describe, expect, it } from 'vitest';

describe('fixture suite', () => {
  it('always fails, so the demo proves a broken Test is excluded from Flaky Tests', () => {
    expect(1 + 1).toBe(3);
  });
});
