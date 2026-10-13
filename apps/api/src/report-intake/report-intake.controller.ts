import { Controller, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  commitShaSchema,
  processingStateSchema,
  submitReportMetadataSchema,
  type SubmitReportMetadata,
  type SubmitReportResponse,
} from '@ftt/contracts';
import type { Request } from 'express';
import { ApiError, ZodPipe } from '../platform/index.js';
import type { Project } from '../projects/index.js';
import { CurrentProject } from './current-project.decorator.js';
import { ReportIntakeService } from './report-intake.service.js';
import { UploadTokenGuard } from './upload-token.guard.js';

/** `POST /api/v1/reports` (FR-05 … FR-11, SRS §9.2). */
@Controller('api/v1/reports')
export class ReportIntakeController {
  constructor(private readonly reportIntake: ReportIntakeService) {}

  @Post()
  @UseGuards(UploadTokenGuard)
  @HttpCode(202)
  async submit(
    @CurrentProject() project: Project,
    @Query('commit', new ZodPipe(commitShaSchema, 'INVALID_COMMIT')) commitSha: string,
    @Query(new ZodPipe(submitReportMetadataSchema)) metadata: SubmitReportMetadata,
    @Req() req: Request,
  ): Promise<SubmitReportResponse> {
    const report = await this.reportIntake.submit({
      project,
      commitSha,
      metadata,
      body: rawBodyOf(req),
    });
    return {
      id: report.id,
      processingState: processingStateSchema.parse(report.processingState),
      duplicate: false,
    };
  }
}

/**
 * Set by the raw-body middleware registered for this route (design §5) when `Content-Type`
 * matches `application/xml`/`text/xml`. Rejecting a wrong Content-Type outright is ticket 07's
 * job (FR-09's `415`); this just refuses to silently store empty content as if it were the
 * real body — FR-11 promises the stored content is byte-identical, never a fabricated empty one.
 */
function rawBodyOf(req: Request): Buffer {
  if (!Buffer.isBuffer(req.body)) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Report body was not received as application/xml or text/xml',
    );
  }
  return req.body;
}
