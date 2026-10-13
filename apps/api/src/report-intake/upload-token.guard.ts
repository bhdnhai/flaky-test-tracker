import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../platform/index.js';
import { ProjectsService, type Project } from '../projects/index.js';

/** Attaches the authenticated Project to the request, for `@CurrentProject()` to read. */
export interface RequestWithProject extends Request {
  project: Project;
}

/**
 * `POST /api/v1/reports` only (FR-05, FR-06). Every failure reason gets the same 401
 * (NFR-06, A07): a missing header, a malformed scheme, or a token that matches no Project.
 */
@Injectable()
export class UploadTokenGuard implements CanActivate {
  constructor(private readonly projects: ProjectsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithProject>();
    const project = await this.projects.authenticate(request.headers.authorization);
    if (!project) throw new ApiError('UNAUTHORIZED', 'Invalid or missing Upload Token');
    request.project = project;
    return true;
  }
}
