import { Module } from '@nestjs/common';
import { FlakeAnalysisService } from './flake-analysis.service.js';

@Module({
  providers: [FlakeAnalysisService],
  exports: [FlakeAnalysisService],
})
export class FlakeAnalysisModule {}
