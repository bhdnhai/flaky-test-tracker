import { Module, type DynamicModule } from '@nestjs/common';
import { PlatformModule, type AppConfig } from './platform/index.js';
import { ProjectsModule } from './projects/index.js';
import { ReadApiModule } from './read-api/index.js';
import { ReportIntakeModule } from './report-intake/index.js';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [PlatformModule.forRoot(config), ProjectsModule, ReportIntakeModule, ReadApiModule],
    };
  }
}
