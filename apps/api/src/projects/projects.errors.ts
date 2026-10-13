/** The requested name doesn't match `^[a-z0-9][a-z0-9-]{0,99}$` (FR-01). */
export class ProjectNameInvalidError extends Error {
  constructor(name: string) {
    super(`Invalid project name: ${name}`);
    this.name = 'ProjectNameInvalidError';
  }
}

/** A Project with this name already exists (FR-01). */
export class ProjectNameTakenError extends Error {
  constructor(name: string) {
    super(`Project already exists: ${name}`);
    this.name = 'ProjectNameTakenError';
  }
}

/** No Project matches the given name or ID (FR-03, SRS §9.2). */
export class ProjectNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Project not found: ${identifier}`);
    this.name = 'ProjectNotFoundError';
  }
}
