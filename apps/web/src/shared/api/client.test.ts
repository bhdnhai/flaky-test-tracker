import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiRequestError,
  getHealth,
  getProjectReports,
  getProjects,
  getTestDetail,
  searchTests,
} from './client';

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

describe('shared API client: getProjects', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('FR-26: returns the Projects list', async () => {
    respondWith(200, {
      items: [
        {
          id: '167a080b-59a4-4f8c-b730-601b820776d4',
          name: 'web-app',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await expect(getProjects()).resolves.toMatchObject({ items: [{ name: 'web-app' }] });
  });
});

describe('shared API client: getProjectReports', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('FR-30: returns a Project’s Reports', async () => {
    respondWith(200, {
      items: [
        {
          id: 'ee5fa0f9-839f-4178-9b66-25be54f67045',
          commitSha: 'a'.repeat(40),
          branch: 'main',
          runId: null,
          runAttempt: null,
          job: null,
          sizeBytes: 10,
          processingState: 'pending',
          error: null,
          collisionWarning: null,
          receivedAt: '2026-01-01T00:00:00.000Z',
          processedAt: null,
        },
      ],
    });

    const result = await getProjectReports('some-project-id');

    expect(result.items).toMatchObject([{ branch: 'main', processingState: 'pending' }]);
  });
});

describe('shared API client: searchTests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AC-23: returns search results including Tests with no Flakes', async () => {
    respondWith(200, {
      items: [
        {
          testId: '167a080b-59a4-4f8c-b730-601b820776d4',
          classname: 'report ingestion',
          name: 'parses',
          totalFlakes: 0,
        },
      ],
    });

    const result = await searchTests('some-project-id', 'INGEST');

    expect(result.items).toMatchObject([{ name: 'parses', totalFlakes: 0 }]);
  });
});

describe('shared API client: getTestDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AC-25: returns the verdict and Commit history', async () => {
    respondWith(200, {
      testId: '167a080b-59a4-4f8c-b730-601b820776d4',
      classname: 'C',
      name: 'X',
      verdict: { flaky: true, totalFlakes: 2, flakesInWindow: 1, windowDays: 14 },
      history: [
        {
          commitSha: 'a'.repeat(40),
          isFlake: true,
          passed: 1,
          failed: 1,
          skipped: 0,
          outcomes: [
            {
              result: 'failed',
              failureMessage: 'boom',
              reportId: '167a080b-59a4-4f8c-b730-601b820776d4',
              branch: 'main',
              runId: null,
              runAttempt: null,
              job: null,
              receivedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    });

    const result = await getTestDetail('some-project-id', 'some-test-id');

    expect(result.verdict).toEqual({
      flaky: true,
      totalFlakes: 2,
      flakesInWindow: 1,
      windowDays: 14,
    });
    expect(result.history).toMatchObject([{ commitSha: 'a'.repeat(40), isFlake: true }]);
  });
});
