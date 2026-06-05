# CAST v3 Local Development

CAST v3 is a PNPM workspace with a React/Vite frontend, an Express API server, and PostgreSQL via Drizzle ORM.

## Prerequisites

- Node.js 24.x. This audit verified Node `v24.14.0`.
- PNPM 10.x. This audit verified PNPM `10.26.1`.
- PostgreSQL 16 or compatible managed PostgreSQL
- An OpenAI API key for AI-assisted analysis workflows

## Environment

Copy the root example file:

```bash
cp .env.example .env
```

Set at minimum:

- `PORT`
- `BASE_PATH`
- `DATABASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

The `AI_INTEGRATIONS_OPENAI_*` names are retained for prototype compatibility. They should be renamed behind a compatibility layer during the production-hardening phase.

## Install

```bash
pnpm install --frozen-lockfile
```

The Replit/Linux PNPM platform-pruning overrides have been removed from `pnpm-workspace.yaml`, and the lockfile has been regenerated in a standard PNPM environment.

To regenerate the lockfile after dependency changes:

```bash
pnpm install --lockfile-only
pnpm install --frozen-lockfile
```

## Database

Create a PostgreSQL database and set `DATABASE_URL`.

Apply the current Drizzle schema:

```bash
pnpm --filter @workspace/db run push
```

For production, prefer audited migrations over `push-force`.

### Disposable Phase 2A Migration Validation

Use a disposable PostgreSQL database before applying Phase 2A migrations to any shared environment.

Docker example:

```bash
docker run --name castv3-phase2a-postgres --rm -e POSTGRES_USER=cast -e POSTGRES_PASSWORD=cast -e POSTGRES_DB=cast_phase2a -p 55432:5432 postgres:16
```

In another terminal:

```bash
export DATABASE_URL="postgresql://cast:cast@localhost:55432/cast_phase2a"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/0001_phase2a_foundation.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/validation/phase2a_verify_objects.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/validation/phase2a_smoke.sql
```

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://cast:cast@localhost:55432/cast_phase2a"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f lib/db/migrations/0001_phase2a_foundation.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f lib/db/validation/phase2a_verify_objects.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f lib/db/validation/phase2a_smoke.sql
```

Hosted disposable database example:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/0001_phase2a_foundation.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/validation/phase2a_verify_objects.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/validation/phase2a_smoke.sql
```

The smoke test runs inside a transaction and ends with `ROLLBACK`, so it verifies inserts and reads without leaving smoke rows behind.

## Development

Frontend only:

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/sar-review run dev
```

PowerShell:

```powershell
$env:PORT="3000"; $env:BASE_PATH="/"; pnpm --filter @workspace/sar-review run dev
```

API server:

```bash
PORT=3000 NODE_ENV=development pnpm --filter @workspace/api-server run dev
```

PowerShell:

```powershell
$env:PORT="3000"; $env:NODE_ENV="development"; pnpm --filter @workspace/api-server run dev
```

The production API server also serves the built frontend when `artifacts/sar-review/dist/public/index.html` exists.

## Build

Production frontend:

```bash
BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/sar-review run build
```

PowerShell:

```powershell
$env:BASE_PATH="/"; $env:PORT="3000"; $env:NODE_ENV="production"; pnpm --filter @workspace/sar-review run build
```

Production API:

```bash
NODE_ENV=production pnpm --filter @workspace/api-server run build
```

PowerShell:

```powershell
$env:NODE_ENV="production"; pnpm --filter @workspace/api-server run build
```

Full workspace typecheck/build:

```bash
pnpm run typecheck
pnpm run build
```

This audit verified the focused production builds:

```bash
BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/sar-review run build
NODE_ENV=production pnpm --filter @workspace/api-server run build
```

The frontend build currently emits a Vite warning that the main minified JS chunk is larger than 500 kB. This is not a build blocker and should be handled later as a performance/code-splitting task.

## Start Production Bundle

```bash
PORT=3000 NODE_ENV=production node --enable-source-maps artifacts/api-server/dist/index.mjs
```

PowerShell:

```powershell
$env:PORT="3000"; $env:NODE_ENV="production"; node --enable-source-maps artifacts/api-server/dist/index.mjs
```

The API server requires these variables at startup in the current prototype architecture:

```bash
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://cast:cast@localhost:5432/cast
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=your-api-key
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-me
```

## Verified Phase 1 Commands

The following commands completed successfully during the Phase 1 foundation pass:

```bash
pnpm install --lockfile-only
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/sar-review run build
NODE_ENV=production pnpm --filter @workspace/api-server run build
```

The built app was also smoke-tested outside Replit with:

```bash
PORT=4177 NODE_ENV=production DATABASE_URL=postgresql://cast:cast@localhost:5432/cast AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1 AI_INTEGRATIONS_OPENAI_API_KEY=dummy-local-key SESSION_SECRET=local-development-secret-change-me-32chars ADMIN_USERNAME=admin ADMIN_PASSWORD=admin node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Health check:

```bash
curl http://127.0.0.1:4177/api/healthz
```

Expected response:

```json
{"status":"ok"}
```

The root route `/` also returned the built React `index.html`, confirming that the production API bundle can serve the built frontend outside Replit.

## Current Limitations

- The current admin login is single-admin environment-variable auth.
- Sessions use the default Express session store and need a production store.
- AI jobs currently run in-process in several areas.
- Replit Vite plugins remain installed for prototype compatibility, but the production frontend and mockup sandbox load them only when `REPL_ID` is present.
- A real PostgreSQL database is still required for DB-backed routes. The smoke test used a placeholder `DATABASE_URL`; only `/api/healthz` and static frontend serving were verified without a live database connection.
- A real OpenAI API key is still required for AI-assisted analysis routes. The smoke test used dummy OpenAI values only to confirm startup.
- Render or any production host must replace the default Express memory session store before multi-user production use.
