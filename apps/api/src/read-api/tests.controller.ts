import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import {
  testSearchQuerySchema,
  type TestDetailResponse,
  type TestSearchResponse,
} from '@ftt/contracts';
import { z } from 'zod';
import type { TestDetail, TestDetailOutcome, TestSearchRow } from '../flake-analysis/index.js';
import { FlakeAnalysisService } from '../flake-analysis/index.js';
import { APP_CONFIG, ApiError, type AppConfig, ZodPipe } from '../platform/index.js';
import { ProjectsService } from '../projects/index.js';

const idParamSchema = z.uuid();

/** `GET /api/v1/projects/{projectId}/tests[?search=][/{testId}]` (FR-24, FR-25, FR-28, FR-29). */
@Controller('api/v1/projects/:projectId/tests')
export class TestsReadController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly flakeAnalysis: FlakeAnalysisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  async search(
    @Param('projectId', new ZodPipe(idParamSchema, 'NOT_FOUND')) projectId: string,
    @Query('search', new ZodPipe(testSearchQuerySchema)) query: string,
  ): Promise<TestSearchResponse> {
    await this.requireProject(projectId);
    const rows = await this.flakeAnalysis.search(projectId, query);
    return { items: rows.map(toSearchItem) };
  }

  @Get(':testId')
  async detail(
    @Param('projectId', new ZodPipe(idParamSchema, 'NOT_FOUND')) projectId: string,
    @Param('testId', new ZodPipe(idParamSchema, 'NOT_FOUND')) testId: string,
  ): Promise<TestDetailResponse> {
    await this.requireProject(projectId);
    const windowDays = this.config.RANKING_WINDOW_DAYS;
    // Ownership check inside the lookup: a Test from another Project is a 404 (SRS §10).
    const detail = await this.flakeAnalysis.testDetail(projectId, testId, windowDays, new Date());
    if (!detail) throw new ApiError('NOT_FOUND', `Test not found: ${testId}`);
    return toDetailResponse(detail);
  }

  private async requireProject(projectId: string): Promise<void> {
    const project = await this.projects.get(projectId);
    if (!project) throw new ApiError('NOT_FOUND', `Project not found: ${projectId}`);
  }
}

function toSearchItem(row: TestSearchRow): TestSearchResponse['items'][number] {
  return {
    testId: row.testId,
    classname: row.classname,
    name: row.name,
    totalFlakes: row.totalFlakes,
  };
}

function toDetailResponse(detail: TestDetail): TestDetailResponse {
  return {
    testId: detail.testId,
    classname: detail.classname,
    name: detail.name,
    verdict: detail.verdict,
    history: detail.history.map((commit) => ({
      commitSha: commit.commitSha,
      isFlake: commit.isFlake,
      passed: commit.passed,
      failed: commit.failed,
      skipped: commit.skipped,
      outcomes: commit.outcomes.map(toOutcome),
    })),
  };
}

function toOutcome(outcome: TestDetailOutcome): TestDetailResponse['history'][number]['outcomes'][number] {
  return {
    result: outcome.result,
    failureMessage: outcome.failureMessage,
    reportId: outcome.reportId,
    branch: outcome.branch,
    runId: outcome.runId,
    runAttempt: outcome.runAttempt,
    job: outcome.job,
    receivedAt: outcome.receivedAt.toISOString(),
  };
}
