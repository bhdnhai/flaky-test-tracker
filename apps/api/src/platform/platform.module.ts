import { Global, Module, type DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { APP_CONFIG, type AppConfig } from './config.js';
import { HealthController } from './health.controller.js';
import { pinoHttpOptions } from './logger.js';
import { PrismaService } from './prisma.service.js';

/** Database client, config, logging, error envelope and health (design §4, §9). */
@Global()
@Module({})
export class PlatformModule {
  static forRoot(config: AppConfig, loggerStream?: DestinationStream): DynamicModule {
    return {
      module: PlatformModule,
      imports: [LoggerModule.forRoot({ pinoHttp: pinoHttpOptions(loggerStream) })],
      controllers: [HealthController],
      providers: [{ provide: APP_CONFIG, useValue: config }, PrismaService],
      exports: [APP_CONFIG, PrismaService],
    };
  }
}
