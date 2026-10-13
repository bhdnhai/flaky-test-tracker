import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import type { DestinationStream } from 'pino';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/platform/index.js';
import { PrismaService } from '../../src/platform/prisma.service.js';
import { ProjectsService } from '../../src/projects/index.js';
import { createTestDatabase } from './database.js';

export interface HttpTestContext {
  app: INestApplication;
  server: Server;
  projects: ProjectsService;
  prisma: PrismaService;
}

/**
 * Boots the HTTP app against a fresh, isolated database for one test. Call `app.close()` after.
 * `loggerStream` captures pino's output instead of writing it to stdout (ticket 10).
 */
export async function createHttpTestContext(loggerStream?: DestinationStream): Promise<HttpTestContext> {
  const config = loadConfig({ DATABASE_URL: await createTestDatabase() });
  const app = await createApp(config, loggerStream);
  await app.init();
  return {
    app,
    server: app.getHttpServer() as Server,
    projects: app.get(ProjectsService),
    prisma: app.get(PrismaService),
  };
}
