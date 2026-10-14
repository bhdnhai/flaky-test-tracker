import { Module } from '@nestjs/common';
import { ReportProcessingService } from './report-processing.service.js';
import { ReportQueueService } from './report-queue.js';

@Module({
  providers: [ReportProcessingService, ReportQueueService],
  exports: [ReportProcessingService, ReportQueueService],
})
export class ReportProcessingModule {}
