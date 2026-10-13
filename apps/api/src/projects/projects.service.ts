import { Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/index.js';
import type { Project } from '../generated/prisma/client.js';
import {
  ProjectNameInvalidError,
  ProjectNameTakenError,
  ProjectNotFoundError,
} from './projects.errors.js';
import { generateUploadToken, hashUploadToken } from './token.js';

/** FR-01: lowercase slug, unique. */
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export interface CreatedProject {
  project: Project;
  token: string;
}

/**
 * Projects and Upload Tokens: create, rotate, resolve a token to a Project (design §4).
 * Tokens are returned only by `create`/`rotateToken`; only hashes are stored (FR-02, NFR-06).
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string): Promise<CreatedProject> {
    if (!NAME_PATTERN.test(name)) throw new ProjectNameInvalidError(name);

    const { token, hash } = generateUploadToken();
    try {
      const project = await this.prisma.project.create({
        data: { name, uploadTokenHash: hash, tokenRotatedAt: new Date() },
      });
      return { project, token };
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ProjectNameTakenError(name);
      throw error;
    }
  }

  async rotateToken(name: string): Promise<string> {
    const { token, hash } = generateUploadToken();
    const result = await this.prisma.project.updateMany({
      where: { name },
      data: { uploadTokenHash: hash, tokenRotatedAt: new Date() },
    });
    if (result.count === 0) throw new ProjectNotFoundError(name);
    return token;
  }

  /** Resolves an `Authorization` header to its Project. Fails the same way for every reason (NFR-06). */
  async authenticate(authorizationHeader: string | undefined): Promise<Project | null> {
    const token = bearerTokenOf(authorizationHeader);
    if (!token) return null;
    return this.prisma.project.findUnique({ where: { uploadTokenHash: hashUploadToken(token) } });
  }

  list(): Promise<Project[]> {
    return this.prisma.project.findMany({ orderBy: { name: 'asc' } });
  }

  get(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { id } });
  }
}

function bearerTokenOf(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  return match?.[1] ?? null;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
