import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadConfig } from './platform/index.js';
import { ReportProcessingService } from './report-processing/index.js';

/** The processing loop's poll interval when there's nothing to do (design §4, ADR-0011). */
const POLL_INTERVAL_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The processing entry point (ADR-0006): claims and processes Reports until stopped. */
async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(config), {
    logger: false,
  });
  const processing = app.get(ReportProcessingService);

  let stopping = false;
  process.on('SIGTERM', () => {
    stopping = true;
  });
  process.on('SIGINT', () => {
    stopping = true;
  });

  while (!stopping) {
    const didWork = await processing.processNext(new Date());
    if (!didWork) await sleep(POLL_INTERVAL_MS);
  }

  await app.close();
}

await main();
