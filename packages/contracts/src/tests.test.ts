import { describe, expect, it } from 'vitest';
import { testSearchQuerySchema } from './tests.js';

describe('testSearchQuerySchema', () => {
  it('AC-24: rejects a 1-character or 201-character query', () => {
    expect(testSearchQuerySchema.safeParse('a').success).toBe(false);
    expect(testSearchQuerySchema.safeParse('a'.repeat(201)).success).toBe(false);
  });

  it('AC-24: accepts a 2-character and a 200-character query', () => {
    expect(testSearchQuerySchema.safeParse('ab').success).toBe(true);
    expect(testSearchQuerySchema.safeParse('a'.repeat(200)).success).toBe(true);
  });
});
