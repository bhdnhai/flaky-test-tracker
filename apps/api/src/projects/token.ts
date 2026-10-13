import { createHash, randomBytes } from 'node:crypto';

/** Secret scanners recognise this prefix (NFR-06). */
const TOKEN_PREFIX = 'ftt_';

/** 256 bits of randomness (NFR-06). */
const TOKEN_RANDOM_BYTES = 32;

/** A newly generated Upload Token and the hash stored for it (FR-02, NFR-06). */
export interface GeneratedUploadToken {
  token: string;
  hash: string;
}

/** Generates a new Upload Token. The token itself is returned only here and from rotation. */
export function generateUploadToken(): GeneratedUploadToken {
  const token = TOKEN_PREFIX + randomBytes(TOKEN_RANDOM_BYTES).toString('base64url');
  return { token, hash: hashUploadToken(token) };
}

/** The SHA-256 hex digest stored in place of the token (FR-02). */
export function hashUploadToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
