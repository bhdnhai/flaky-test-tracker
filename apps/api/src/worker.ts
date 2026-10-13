import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { loadConfig, SystemClock } from './platform/index.js';
import { ReportProcessingService } from './report-processing/index.js';

/** The processing loop's poll interval when there's nothing to do (design §4, ADR-0011). */
const POLL_INTERVAL_MS = 500;

/** How often the worker releases expired claims (NFR-04); well under the 60 s claim window. */
const SWEEP_INTERVAL_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The processing entry point (ADR-0006): claims and processes Reports until stopped. */
async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(config), {
    logger: false,
  });
  app.useLogger(app.get(PinoLogger));
  const processing = app.get(ReportProcessingService);
  const clock = new SystemClock();
  const logger = new Logger('Worker');

  let stopping = false;
  process.on('SIGTERM', () => {
    stopping = true;
  });
  process.on('SIGINT', () => {
    stopping = true;
  });

  const sweepTimer = setInterval(() => {
    processing.sweep(clock.now()).catch((error: unknown) => {
      logger.error({ event: 'sweep-failed', err: error });
    });
  }, SWEEP_INTERVAL_MS);

  while (!stopping) {
    const didWork = await processing.processNext(clock.now());
    if (!didWork) await sleep(POLL_INTERVAL_MS);
  }

  clearInterval(sweepTimer);
  await app.close();
}

await main();
