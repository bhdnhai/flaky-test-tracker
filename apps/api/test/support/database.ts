import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { inject } from 'vitest';
import { TEMPLATE_DATABASE, withDatabase } from '../global-setup.js';

/** Creates an isolated, migrated database for one test file and returns its URL. */
export async function createTestDatabase(): Promise<string> {
  const adminUrl = inject('postgresAdminUrl');
  const name = `test_${randomUUID().replaceAll('-', '')}`;

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE_DATABASE}"`);
  } finally {
    await admin.end();
  }

  return withDatabase(adminUrl, name);
}
