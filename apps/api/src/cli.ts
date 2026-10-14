import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadConfig } from './platform/index.js';
import { ProjectsService } from './projects/index.js';
import { ReportQueueService } from './report-processing/index.js';

/** Usage or an unknown command (FR-04). */
class CliUsageError extends Error {}

/**
 * `create-project <name>`, `rotate-token <name>` and `reprocess-report <reportId>`
 * (SRS §9.3), run via `docker compose exec`.
 */
async function main(): Promise<number> {
  const [command, name] = process.argv.slice(2);
  const config = loadConfig(process.env);
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(config), {
    logger: false,
  });

  try {
    const projects = app.get(ProjectsService);
    const reportQueue = app.get(ReportQueueService);
    switch (command) {
      case 'create-project': {
        if (!name) throw new CliUsageError('Usage: create-project <name>');
        const { project, token } = await projects.create(name);
        console.log(`Created project "${project.name}" (${project.id})`);
        console.log(token);
        return 0;
      }
      case 'rotate-token': {
        if (!name) throw new CliUsageError('Usage: rotate-token <name>');
        const token = await projects.rotateToken(name);
        console.log(token);
        return 0;
      }
      case 'reprocess-report': {
        if (!name) throw new CliUsageError('Usage: reprocess-report <reportId>');
        await reportQueue.requeue(name);
        console.log('pending');
        return 0;
      }
      default:
        throw new CliUsageError(`Unknown command: ${command ?? '(none)'}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    await app.close();
  }
}

process.exitCode = await main();
