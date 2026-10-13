import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ErrorEnvelopeFilter, type AppConfig } from './platform/index.js';

/** Builds the HTTP application. Used by main.ts and the tests. */
export async function createApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config));
  app.useGlobalFilters(new ErrorEnvelopeFilter());
  app.enableShutdownHooks();
  return app;
}
