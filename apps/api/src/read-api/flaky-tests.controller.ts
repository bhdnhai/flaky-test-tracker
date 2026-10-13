import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { FlakyTestsListResponse } from '@ftt/contracts';
import { z } from 'zod';
import { FlakeAnalysisService } from '../flake-analysis/index.js';
import { APP_CONFIG, ApiError, type AppConfig, ZodPipe } from '../platform/index.js';
import { ProjectsService } from '../projects/index.js';

/** `GET /api/v1/projects/{projectId}/flaky-tests` (FR-21, FR-22, FR-23, FR-27). */
@Controller('api/v1/projects/:projectId/flaky-tests')
export class FlakyTestsReadController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly flakeAnalysis: FlakeAnalysisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  async list(
    @Param('projectId', new ZodPipe(z.uuid(), 'NOT_FOUND')) projectId: string,
  ): Promise<FlakyTestsListResponse> {
    const project = await this.projects.get(projectId);
    if (!project) throw new ApiError('NOT_FOUND', `Project not found: ${projectId}`);

    const windowDays = this.config.RANKING_WINDOW_DAYS;
    const rows = await this.flakeAnalysis.flakyTests(projectId, windowDays, new Date());
    return {
      windowDays,
      items: rows.map((row) => ({
        testId: row.testId,
        classname: row.classname,
        name: row.name,
        flakeCount: row.flakeCount,
        lastFlakeAt: row.lastFlakeAt.toISOString(),
      })),
    };
  }
}
