import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Project } from '../projects/index.js';
import type { RequestWithProject } from './upload-token.guard.js';

/** The Project resolved by `UploadTokenGuard` from the submission's Upload Token. */
export const CurrentProject = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Project => {
    const request = ctx.switchToHttp().getRequest<RequestWithProject>();
    return request.project;
  },
);
