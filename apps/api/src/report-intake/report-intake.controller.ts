import { Controller, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import {
  commitShaSchema,
  processingStateSchema,
  submitReportMetadataSchema,
  type SubmitReportMetadata,
  type SubmitReportResponse,
} from '@ftt/contracts';
import type { Request, Response } from 'express';
import { ZodPipe } from '../platform/index.js';
import type { Project } from '../projects/index.js';
import { CurrentProject } from './current-project.decorator.js';
import { ReportBodyGuard } from './report-body.guard.js';
import { ReportIntakeService } from './report-intake.service.js';
import { UploadTokenGuard } from './upload-token.guard.js';
import { xmlPreCheck } from './xml-pre-check.js';

/** `POST /api/v1/reports` (FR-05 … FR-12, SRS §9.2). */
@Controller('api/v1/reports')
export class ReportIntakeController {
  constructor(private readonly reportIntake: ReportIntakeService) {}

  @Post()
  @UseGuards(UploadTokenGuard, ReportBodyGuard)
  async submit(
    @CurrentProject() project: Project,
    @Query('commit', new ZodPipe(commitShaSchema, 'INVALID_COMMIT')) commitSha: string,
    @Query(new ZodPipe(submitReportMetadataSchema)) metadata: SubmitReportMetadata,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SubmitReportResponse> {
    const body = req.body as Buffer;
    // Design §5 step 6, run after the commit/metadata pipes (step 5) so that order is kept.
    xmlPreCheck(body);

    const { report, duplicate } = await this.reportIntake.submit({
      project,
      commitSha,
      metadata,
      body,
    });
    res.status(duplicate ? 200 : 202);
    return {
      id: report.id,
      processingState: processingStateSchema.parse(report.processingState),
      duplicate,
    };
  }
}
