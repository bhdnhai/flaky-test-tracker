import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@ftt/contracts';
import { ApiError } from './api-error.js';
import { PrismaService } from './prisma.service.js';

/** `GET /health` (NFR-11): 200 when the database answers `SELECT 1`, otherwise 503. */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ApiError('UNAVAILABLE', 'Database is unreachable');
    }
    return { status: 'ok' };
  }
}
