import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { AppModule } from './app.module.js';
import { ErrorEnvelopeFilter, type AppConfig } from './platform/index.js';

// Matches FR-09's eventual cap so the raw parser doesn't reject ordinary Reports with
// Express's small default limit. An oversized body already gets a correct 413
// REPORT_TOO_LARGE as a side effect (via ErrorEnvelopeFilter's framework-error mapping), but
// FR-09's other checks — empty body (400), wrong Content-Type (415) — are still ticket 07's job.
const REPORT_BODY_LIMIT = '10mb';

/** Builds the HTTP application. Used by main.ts and the tests. */
export async function createApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config));
  // The submission body is the raw JUnit XML document, not JSON (design §5).
  app.use(
    '/api/v1/reports',
    raw({ type: ['application/xml', 'text/xml'], limit: REPORT_BODY_LIMIT }),
  );
  app.useGlobalFilters(new ErrorEnvelopeFilter());
  app.enableShutdownHooks();
  return app;
}
