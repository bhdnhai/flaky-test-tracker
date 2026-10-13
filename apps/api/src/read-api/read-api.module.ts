import { Module } from '@nestjs/common';
import { FlakeAnalysisModule } from '../flake-analysis/index.js';
import { ProjectsModule } from '../projects/index.js';
import { ReportIntakeModule } from '../report-intake/index.js';
import { FlakyTestsReadController } from './flaky-tests.controller.js';
import { ProjectsReadController } from './projects.controller.js';
import { ReportsReadController } from './reports.controller.js';
import { TestsReadController } from './tests.controller.js';

@Module({
  imports: [ProjectsModule, ReportIntakeModule, FlakeAnalysisModule],
  controllers: [
    ProjectsReadController,
    ReportsReadController,
    FlakyTestsReadController,
    TestsReadController,
  ],
})
export class ReadApiModule {}
