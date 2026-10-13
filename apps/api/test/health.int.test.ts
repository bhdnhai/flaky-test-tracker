import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { errorEnvelopeSchema, healthResponseSchema } from '@ftt/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/platform/index.js';
import { createTestDatabase } from './support/database.js';

describe('GET /health', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('AC-38: returns 200 {status: "ok"} when the database is reachable', async () => {
    app = await createApp(loadConfig({ DATABASE_URL: await createTestDatabase() }));
    await app.init();

    const res = await request(app.getHttpServer() as Server).get('/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('AC-38: returns 503 with the error envelope when the database is unreachable', async () => {
    // Port 1 on loopback refuses connections: the same failure as a stopped database.
    app = await createApp(loadConfig({ DATABASE_URL: 'postgresql://ftt:ftt@127.0.0.1:1/ftt' }));
    await app.init();

    const res = await request(app.getHttpServer() as Server).get('/health');

    expect(res.status).toBe(503);
    const body = errorEnvelopeSchema.parse(res.body);
    expect(body.error.code).toBe('UNAVAILABLE');
    expect(body.error.message).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/);
  });
});
