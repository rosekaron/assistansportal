<!-- generated-by: gsd-doc-writer -->
# Development Guide

This guide covers local setup, build commands, code style, and the pull request process for contributors working on the Assistansportal codebase.

---

## Local Setup

### Prerequisites

- Node.js `>= 22` (the devcontainer base image uses `mcr.microsoft.com/devcontainers/javascript-node:dev-22-bookworm`)
- Docker and Docker Compose (used to run PostgreSQL and, optionally, the full dev container)
- npm (bundled with Node.js)

### Option A — native (host machine)

1. Clone the repository and enter the project directory:
   ```bash
   git clone <repo-url>
   cd assistansportal
   ```
2. Install root-level tooling (Husky git hooks, Concurrently):
   ```bash
   npm install
   ```
3. Install server and client dependencies:
   ```bash
   npm install --prefix server
   npm install --prefix client
   ```
4. Copy the sample env file to `.env` and fill in any values you need to change:
   ```bash
   cp .env.sample .env
   ```
   The defaults in `.env.sample` match the Docker Compose database credentials, so no changes are needed for local dev if you use Docker for Postgres.
5. Start the PostgreSQL container:
   ```bash
   docker compose up -d postgres
   ```
6. Push the schema to the database:
   ```bash
   npm run db:push --prefix server
   ```
7. (Optional) Seed the current month's schedule data:
   ```bash
   npx tsx server/scripts/seed-current-month.ts
   ```

### Option B — Dev Container (VS Code)

The repository ships a fully configured Dev Container that includes Node.js 22, PostgreSQL, Playwright browser dependencies, and Claude Code.

```bash
# From the project root
npm run devcontainer:up
```

Open the workspace in VS Code via "Reopen in Container". The `postStartCommand` re-applies the `node` user password on each container start using the `NODE_PASSWORD` value from `.env`.

To tear down the container:
```bash
npm run devcontainer:down
```

---

## Build Commands

### Root workspace

| Command | Description |
|---|---|
| `npm run dev` | Start both server and client in watch mode concurrently |
| `npm run devcontainer:up` | Build and start the VS Code Dev Container |
| `npm run devcontainer:down` | Stop and remove the Dev Container |

### Server (`cd server` or use `--prefix server`)

| Command | Description |
|---|---|
| `npm run dev` | Start the API server with `tsx watch` (hot-reload on file change) |
| `npm run build` | Compile TypeScript to `dist/` via `tsc` |
| `npm run start` | Run the compiled server from `dist/index.js` |
| `npm run db:push` | Apply the Drizzle schema to the database without a migration file |
| `npm run db:generate` | Generate a Drizzle migration file from schema changes |
| `npm run db:studio` | Open Drizzle Studio in the browser for database inspection |
| `npm run test` | Run unit/integration tests with Vitest |
| `npm run test:coverage` | Run tests and produce a V8 coverage report |

### Client (`cd client` or use `--prefix client`)

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server on port `5173` (proxies `/api` to `localhost:3001`) |
| `npm run build` | Type-check with `tsc` then bundle with Vite |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run component/unit tests with Vitest in jsdom environment |
| `npm run test:coverage` | Run tests and produce a V8 coverage report |
| `npm run test:e2e` | Run Playwright end-to-end tests against `http://localhost:5173` |

---

## Code Style

No ESLint or Prettier configuration files are present in the repository at this time. Both packages enforce TypeScript strict mode (`"strict": true` in `tsconfig.json`).

**TypeScript — server**
- Target: `ES2022`, module system: `CommonJS`
- Config: `server/tsconfig.json`
- Strict mode enabled; all `tsc` errors must be resolved before a production build succeeds

**TypeScript — client**
- Config: `client/tsconfig.json` and `client/tsconfig.node.json`
- Strict mode enabled
- Path alias `@` resolves to `client/src/`

**Tailwind CSS**
- Config: `client/tailwind.config.js`
- PostCSS config: `client/postcss.config.js`
- Use Tailwind utility classes directly; avoid writing custom CSS where a utility exists

---

## Git Hooks

Husky is installed at the root. The only active hook is `.husky/post-commit`.

The post-commit hook auto-pushes the current branch to `origin` when a commit message matches the pattern `docs(phase-<number>): <anything>`. This is used by the GSD workflow to sync phase-completion doc commits automatically. It is a silent no-op for all other commit messages.

---

## Branch Conventions

No formal branch naming policy is documented in the repository. In practice, the active development branch follows the pattern `milestone/v<major>.<minor>.<patch>` (e.g., `milestone/v1.0.1`). Feature work should branch off `main` and use descriptive names such as `feat/<short-description>` or `fix/<short-description>`.

The default integration branch is `main`.

---

## PR Process

No `.github/PULL_REQUEST_TEMPLATE.md` is present. Follow these guidelines when opening a pull request:

- Branch from `main`; keep the branch focused on a single concern.
- Ensure `npm run build --prefix server` and `npm run build --prefix client` both exit without errors.
- Run `npm run test --prefix server` and `npm run test --prefix client` and confirm all tests pass.
- Include a short description of what changed and why in the PR body.
- Reference any related issue or compliance rule (Försäkringskassan rule IDs are documented in `docs/fk-rules.md`).
- Request at least one review before merging.
