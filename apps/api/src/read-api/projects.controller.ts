import { Controller, Get } from '@nestjs/common';
import type { ProjectsListResponse } from '@ftt/contracts';
import { ProjectsService } from '../projects/index.js';

/** `GET /api/v1/projects` (FR-26). */
@Controller('api/v1/projects')
export class ProjectsReadController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(): Promise<ProjectsListResponse> {
    const items = await this.projects.list();
    return {
      items: items.map((project) => ({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt.toISOString(),
      })),
    };
  }
}
