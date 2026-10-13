import { Global, Module, type DynamicModule } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from './config.js';
import { HealthController } from './health.controller.js';
import { PrismaService } from './prisma.service.js';

/** Database client, config, error envelope and health (design §4). */
@Global()
@Module({})
export class PlatformModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: PlatformModule,
      controllers: [HealthController],
      providers: [{ provide: APP_CONFIG, useValue: config }, PrismaService],
      exports: [APP_CONFIG, PrismaService],
    };
  }
}
