import { Module, type DynamicModule } from '@nestjs/common';
import { PlatformModule, type AppConfig } from './platform/index.js';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return { module: AppModule, imports: [PlatformModule.forRoot(config)] };
  }
}
