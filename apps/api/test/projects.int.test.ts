import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadConfig } from '../src/platform/index.js';
import {
  ProjectNameInvalidError,
  ProjectNameTakenError,
  ProjectsService,
} from '../src/projects/index.js';
import { createTestDatabase } from './support/database.js';

describe('ProjectsService (Operator CLI, via the Nest application context)', () => {
  let app: INestApplicationContext | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createContext(): Promise<ProjectsService> {
    const config = loadConfig({ DATABASE_URL: await createTestDatabase() });
    app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: false });
    return app.get(ProjectsService);
  }

  it('AC-01: create-project prints a token starting with ftt_, and stores only its hash', async () => {
    const projects = await createContext();

    const { project, token } = await projects.create('web-app');

    expect(token.startsWith('ftt_')).toBe(true);
    expect(project.name).toBe('web-app');
    expect(project.uploadTokenHash).not.toBe(token);

    const authenticated = await projects.authenticate(`Bearer ${token}`);
    expect(authenticated?.id).toBe(project.id);
  });

  it('AC-02: create-project fails for a name that already exists', async () => {
    const projects = await createContext();
    await projects.create('web-app');

    await expect(projects.create('web-app')).rejects.toThrow(ProjectNameTakenError);
    expect(await projects.list()).toHaveLength(1);
  });

  it('AC-02: create-project fails for a name outside the allowed pattern, and creates nothing', async () => {
    const projects = await createContext();

    await expect(projects.create('Web_App')).rejects.toThrow(ProjectNameInvalidError);
    expect(await projects.list()).toHaveLength(0);
  });

  it('AC-03: rotate-token invalidates the previous token and issues a new, working one', async () => {
    const projects = await createContext();
    const { token: t1 } = await projects.create('web-app');

    const t2 = await projects.rotateToken('web-app');

    expect(await projects.authenticate(`Bearer ${t1}`)).toBeNull();
    const authenticated = await projects.authenticate(`Bearer ${t2}`);
    expect(authenticated?.name).toBe('web-app');
  });

  it('AC-05: authenticate fails the same way for a missing, malformed or unknown token', async () => {
    const projects = await createContext();

    expect(await projects.authenticate(undefined)).toBeNull();
    expect(await projects.authenticate('not-bearer-scheme')).toBeNull();
    expect(await projects.authenticate('Bearer ftt_doesnotexist')).toBeNull();
  });
});
