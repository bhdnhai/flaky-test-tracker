import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/index.js';
import { ReportIntakeController } from './report-intake.controller.js';
import { ReportIntakeService } from './report-intake.service.js';
import { UploadTokenGuard } from './upload-token.guard.js';

@Module({
  imports: [ProjectsModule],
  controllers: [ReportIntakeController],
  providers: [ReportIntakeService, UploadTokenGuard],
  exports: [ReportIntakeService],
})
export class ReportIntakeModule {}
