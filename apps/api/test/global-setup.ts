import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

export const TEMPLATE_DATABASE = 'ftt_template';

declare module 'vitest' {
  export interface ProvidedContext {
    postgresAdminUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

/**
 * One Postgres container per test run (ADR-0010). The real migrations are applied to a
 * template database; each test file clones it (see support/database.ts).
 */
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();
  const adminUrl = container.getConnectionUri();

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: withDatabase(adminUrl, TEMPLATE_DATABASE) },
    stdio: 'pipe',
  });

  project.provide('postgresAdminUrl', adminUrl);
}

/** The same server URL, pointing at another database. */
export function withDatabase(serverUrl: string, database: string): string {
  const url = new URL(serverUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
