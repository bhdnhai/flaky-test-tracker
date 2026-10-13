import { Controller, Get, Param } from '@nestjs/common';
import {
  processingStateSchema,
  type ReportListItem,
  type ReportsListResponse,
} from '@ftt/contracts';
import { z } from 'zod';
import { ApiError, ZodPipe } from '../platform/index.js';
import { ProjectsService } from '../projects/index.js';
import { ReportIntakeService } from '../report-intake/index.js';
import type { Report } from '../generated/prisma/client.js';

// A malformed id can never match a real resource, so it fails the same way an unknown one
// does (design §7: Zod at every HTTP input, including path parameters).
const idParamSchema = z.uuid();

/** `GET /api/v1/projects/{projectId}/reports[/{reportId}]` (FR-30, SRS §9.2). */
@Controller('api/v1/projects/:projectId/reports')
export class ReportsReadController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly reportIntake: ReportIntakeService,
  ) {}

  @Get()
  async list(
    @Param('projectId', new ZodPipe(idParamSchema, 'NOT_FOUND')) projectId: string,
  ): Promise<ReportsListResponse> {
    await this.requireProject(projectId);
    const reports = await this.reportIntake.listForProject(projectId);
    return { items: reports.map(toReportListItem) };
  }

  @Get(':reportId')
  async get(
    @Param('projectId', new ZodPipe(idParamSchema, 'NOT_FOUND')) projectId: string,
    @Param('reportId', new ZodPipe(idParamSchema, 'NOT_FOUND')) reportId: string,
  ): Promise<ReportListItem> {
    await this.requireProject(projectId);
    // Ownership check inside the lookup: a Report from another Project is a 404 (SRS §10).
    const report = await this.reportIntake.findOne(projectId, reportId);
    if (!report) throw new ApiError('NOT_FOUND', `Report not found: ${reportId}`);
    return toReportListItem(report);
  }

  private async requireProject(projectId: string): Promise<void> {
    const project = await this.projects.get(projectId);
    if (!project) throw new ApiError('NOT_FOUND', `Project not found: ${projectId}`);
  }
}

function toReportListItem(report: Report): ReportListItem {
  return {
    id: report.id,
    commitSha: report.commitSha,
    branch: report.branch,
    runId: report.ciRunId,
    runAttempt: report.ciRunAttempt,
    job: report.ciJob,
    sizeBytes: report.sizeBytes,
    processingState: processingStateSchema.parse(report.processingState),
    error: report.error,
    collisionWarning: report.collisionWarning,
    receivedAt: report.receivedAt.toISOString(),
    processedAt: report.processedAt?.toISOString() ?? null,
  };
}
