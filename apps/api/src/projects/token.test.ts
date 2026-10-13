import { describe, expect, it } from 'vitest';
import { generateUploadToken, hashUploadToken } from './token.js';

describe('upload tokens', () => {
  it('NFR-06: starts with ftt_ and carries at least 256 bits of randomness', () => {
    const { token } = generateUploadToken();

    expect(token.startsWith('ftt_')).toBe(true);
    const randomPart = token.slice('ftt_'.length);
    expect(Buffer.from(randomPart, 'base64url').length).toBeGreaterThanOrEqual(32);
  });

  it('NFR-06: two generated tokens are never equal', () => {
    const a = generateUploadToken();
    const b = generateUploadToken();

    expect(a.token).not.toBe(b.token);
  });

  it('AC-01: the stored hash is the token’s SHA-256 hex digest, not the token itself', () => {
    const { token, hash } = generateUploadToken();

    expect(hash).toBe(hashUploadToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
  });

  it('NFR-06: hashing is deterministic, so the same token always hashes the same way', () => {
    const { token } = generateUploadToken();

    expect(hashUploadToken(token)).toBe(hashUploadToken(token));
  });
});
