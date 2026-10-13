# One repository with npm workspaces

Status: accepted

## Context

The API, the worker, the CLI, the dashboard, the fixture suite and the request/response contracts change together. A Report field added in one place has to appear in the API, the contracts and the dashboard in the same commit. Reviewers must be able to run everything with only Docker and Node installed (NFR-13). Corepack, which used to make pnpm and yarn available out of the box, is no longer bundled with Node from v25.

## Considered options

- **Separate repositories for api and web.** These give independent release cycles, which we don't need. A contract change then needs coordinated changes across repositories, and reviewers would have to clone and wire up two projects.
- **pnpm workspaces.** Faster installs and strict dependency isolation. But it requires an extra installation step (Corepack is no longer guaranteed), which conflicts with NFR-13's "only Docker and Node".
- **A monorepo build tool on top (Turborepo or Nx).** Task caching and dependency-aware builds pay off with many packages. With three workspaces, it is technology for show.
- **npm workspaces in one repository.** (chosen)

## Decision

One repository. npm workspaces: `apps/api`, `apps/web`, `packages/contracts`, `fixtures/flaky-suite`. No monorepo build tool. Root scripts orchestrate the workspaces with `npm run <script> --workspaces`.

## Consequences

- One clone, one install, one lockfile. A contract change is one atomic commit.
- npm's hoisting is less strict than pnpm's, so a package could accidentally import a dependency it doesn't declare. Lint rules (`import/no-extraneous-dependencies`) mitigate this.
- If the number of packages or CI build time grows enough to matter, adding Turborepo is additive and doesn't change the layout.
