import { Module, type DynamicModule } from '@nestjs/common';
import type { DestinationStream } from 'pino';
import { PlatformModule, type AppConfig } from './platform/index.js';
import { ProjectsModule } from './projects/index.js';
import { ReadApiModule } from './read-api/index.js';
import { ReportIntakeModule } from './report-intake/index.js';
import { ReportProcessingModule } from './report-processing/index.js';

@Module({})
export class AppModule {
  /** `loggerStream` overrides pino's destination; tests use it to capture log output. */
  static forRoot(config: AppConfig, loggerStream?: DestinationStream): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot(config, loggerStream),
        ProjectsModule,
        ReportIntakeModule,
        ReportProcessingModule,
        ReadApiModule,
      ],
    };
  }
}
