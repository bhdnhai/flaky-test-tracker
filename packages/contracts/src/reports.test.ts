import { describe, expect, it } from 'vitest';
import { commitShaSchema, submitReportMetadataSchema } from './reports.js';

describe('commitShaSchema', () => {
  it('AC-06: rejects a missing, too-short or non-hex commit', () => {
    expect(commitShaSchema.safeParse(undefined).success).toBe(false);
    expect(commitShaSchema.safeParse('abc123').success).toBe(false);
    expect(commitShaSchema.safeParse('a'.repeat(39)).success).toBe(false);
    expect(commitShaSchema.safeParse(`${'a'.repeat(39)}g`).success).toBe(false);
  });

  it('AC-06: accepts a 40-character SHA in uppercase and stores it lowercase', () => {
    const upper = 'A'.repeat(40);
    const result = commitShaSchema.safeParse(upper);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe('a'.repeat(40));
  });

  it('FR-07: also accepts a 64-character SHA (lowercase unchanged)', () => {
    const sha = 'a'.repeat(64);

    expect(commitShaSchema.safeParse(sha)).toMatchObject({ success: true, data: sha });
  });
});

describe('submitReportMetadataSchema', () => {
  it('AC-07: rejects runAttempt=0 and runAttempt=x', () => {
    expect(submitReportMetadataSchema.safeParse({ runAttempt: '0' }).success).toBe(false);
    expect(submitReportMetadataSchema.safeParse({ runAttempt: 'x' }).success).toBe(false);
  });

  it('AC-07: accepts branch, runId, runAttempt and job together', () => {
    const result = submitReportMetadataSchema.safeParse({
      branch: 'main',
      runId: '123',
      runAttempt: '2',
      job: 'test',
    });

    expect(result).toMatchObject({
      success: true,
      data: { branch: 'main', runId: '123', runAttempt: 2, job: 'test' },
    });
  });

  it('FR-08: rejects a branch or job over 255 characters, and a runId over 64', () => {
    expect(submitReportMetadataSchema.safeParse({ branch: 'x'.repeat(256) }).success).toBe(false);
    expect(submitReportMetadataSchema.safeParse({ job: 'x'.repeat(256) }).success).toBe(false);
    expect(submitReportMetadataSchema.safeParse({ runId: 'x'.repeat(65) }).success).toBe(false);
  });

  it('FR-08: metadata is entirely optional', () => {
    expect(submitReportMetadataSchema.safeParse({})).toMatchObject({ success: true, data: {} });
  });
});
