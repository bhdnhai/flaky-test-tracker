import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, getHealth } from './client';

function respondWith(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
}

describe('shared API client: getHealth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('NFR-11: returns the parsed health status on 200', async () => {
    respondWith(200, { status: 'ok' });

    await expect(getHealth()).resolves.toEqual({ status: 'ok' });
  });

  it('SRS §9.1: throws an ApiRequestError carrying the envelope code on 503', async () => {
    respondWith(503, {
      error: { code: 'UNAVAILABLE', message: 'Database is unreachable', requestId: 'r-1' },
    });

    const error = await getHealth().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 503, code: 'UNAVAILABLE', requestId: 'r-1' });
  });

  it('ADR-0013: rejects a 200 body that does not match the contract', async () => {
    respondWith(200, { status: 'maybe' });

    await expect(getHealth()).rejects.toThrow();
  });
});
