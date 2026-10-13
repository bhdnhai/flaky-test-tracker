import type { Server } from 'node:http';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { errorEnvelopeSchema } from '@ftt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErrorEnvelopeFilter } from './error-envelope.filter.js';

@Controller()
class ThrowingController {
  @Get('boom')
  boom(): never {
    throw new Error('connect ECONNREFUSED 10.0.0.5:5432 at PrismaClient.query (/app/dist/x.js)');
  }
}

describe('ErrorEnvelopeFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThrowingController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalFilters(new ErrorEnvelopeFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('SRS §9.1: maps an unknown error to 500 INTERNAL_ERROR without leaking internals', async () => {
    const res = await request(app.getHttpServer() as Server).get('/boom');

    expect(res.status).toBe(500);
    const body = errorEnvelopeSchema.parse(res.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|PrismaClient|\/app\//);
    expect(body.error.requestId).not.toBe('');
  });

  it('SRS §9.1: wraps framework errors such as an unknown route in the envelope', async () => {
    const res = await request(app.getHttpServer() as Server).get('/no-such-route');

    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('SRS §9.1: maps a body-parser size rejection to 413 REPORT_TOO_LARGE', async () => {
    const oversized = JSON.stringify({ padding: 'x'.repeat(200 * 1024) });

    const res = await request(app.getHttpServer() as Server)
      .post('/boom')
      .set('Content-Type', 'application/json')
      .send(oversized);

    expect(res.status).toBe(413);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('REPORT_TOO_LARGE');
  });
});
