import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
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
  const processing = app.get(ReportProcessingService);
  const clock = new SystemClock();

  let stopping = false;
  process.on('SIGTERM', () => {
    stopping = true;
  });
  process.on('SIGINT', () => {
    stopping = true;
  });

  const sweepTimer = setInterval(() => {
    processing.sweep(clock.now()).catch((error: unknown) => {
      console.error('sweep failed', error);
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
