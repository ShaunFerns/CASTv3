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
- `CAST_BOOTSTRAP_ADMIN_EMAIL`
- `CAST_BOOTSTRAP_ADMIN_NAME`
- `CAST_BOOTSTRAP_ADMIN_PASSWORD`
- `CAST_BOOTSTRAP_INSTITUTION_NAME`
- `CAST_BOOTSTRAP_INSTITUTION_SLUG`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

The `AI_INTEGRATIONS_OPENAI_*` names are retained for prototype compatibility. They should be renamed behind a compatibility layer during the production-hardening phase.

### CAST v3 Bootstrap Admin Access

CAST v3 no longer uses the preview bridge as its access model. Until full Supabase Auth/OIDC is implemented, local and production deployments use a configured bootstrap admin account.

The `/admin/login` screen posts to `/api/cast-v3/auth/bootstrap-login`. On first successful login the API creates or reuses:

- an institution
- an active CAST v3 user
- an active institution membership
- an institution-admin role assignment
- the required membership role link

The login stores `req.session.castUserId` and `req.session.selectedInstitutionId`, allowing Phase 3B middleware to resolve a real CAST v3 request context. This makes `/api/security/context`, `/api/ingestion/*`, `/api/programme-workspace/*` and programme map APIs usable without bypassing middleware.

```bash
CAST_BOOTSTRAP_ADMIN_EMAIL=admin@example.edu
CAST_BOOTSTRAP_ADMIN_NAME="CAST Bootstrap Admin"
CAST_BOOTSTRAP_ADMIN_PASSWORD="Use-A-Strong-Password-2026!"
CAST_BOOTSTRAP_INSTITUTION_NAME="CAST Preview Institution"
CAST_BOOTSTRAP_INSTITUTION_SLUG=cast-preview
```

In production, the bootstrap password must be at least 16 characters and include uppercase, lowercase, number and symbol characters. `SESSION_SECRET` must be at least 32 characters and must not use a placeholder.

Legacy `/api/auth/*` admin login remains for legacy prototype routes only. `CAST_V3_PREVIEW_BRIDGE` is obsolete for CAST v3 access and must remain disabled in production.

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
CAST_BOOTSTRAP_ADMIN_EMAIL=admin@example.edu
CAST_BOOTSTRAP_ADMIN_NAME="CAST Bootstrap Admin"
CAST_BOOTSTRAP_ADMIN_PASSWORD="Use-A-Strong-Password-2026!"
CAST_BOOTSTRAP_INSTITUTION_NAME="CAST Preview Institution"
CAST_BOOTSTRAP_INSTITUTION_SLUG=cast-preview
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
PORT=4177 NODE_ENV=production DATABASE_URL=postgresql://cast:cast@localhost:5432/cast AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1 AI_INTEGRATIONS_OPENAI_API_KEY=dummy-local-key SESSION_SECRET=local-development-secret-change-me-32chars CAST_BOOTSTRAP_ADMIN_EMAIL=admin@example.edu CAST_BOOTSTRAP_ADMIN_NAME="CAST Bootstrap Admin" CAST_BOOTSTRAP_ADMIN_PASSWORD="Use-A-Strong-Password-2026!" CAST_BOOTSTRAP_INSTITUTION_NAME="CAST Preview Institution" CAST_BOOTSTRAP_INSTITUTION_SLUG=cast-preview ADMIN_USERNAME=admin ADMIN_PASSWORD=admin node --enable-source-maps artifacts/api-server/dist/index.mjs
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
- Sessions use PostgreSQL-backed `app_sessions` storage and require `0008_phase3b_identity_sessions_roles.sql`.
- AI jobs currently run in-process in several areas.
- Replit Vite plugins remain installed for prototype compatibility, but the production frontend and mockup sandbox load them only when `REPL_ID` is present.
- A real PostgreSQL database with migrations through `0009` is required for DB-backed routes, session persistence and CAST v3 ingestion. The lightweight smoke test can still use a placeholder `DATABASE_URL` for `/api/healthz` and static frontend serving because no session is saved on that route.
- A real OpenAI API key is still required for AI-assisted analysis routes. The smoke test used dummy OpenAI values only to confirm startup.
- Render or any production host must apply the core migrations through `0009_phase4a_curriculum_ingestion.sql` before using the CAST v3 ingestion routes.

### CAST v3 Ingestion Routes

Phase 4A adds secured API routes:

- `GET /api/ingestion/runs`
- `POST /api/ingestion/akari`
- `POST /api/ingestion/pdf`
- `POST /api/ingestion/manual-module`

These routes require the Phase 3B CAST identity session and institution context. Use the CAST v3 bootstrap login to create that context; the legacy admin-only session does not grant access to these routes.

### CAST v3 Programme Map Validation

Phase 5A adds the programme map projection and framework-layer API/UI foundation without adding new database tables. The validation script creates a disposable map-ready programme, framework, programme-owned attribute, expectations, evidence item and data-quality indicator inside a transaction, then rolls the transaction back.

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require node scripts/phase5a-programme-map-validation.mjs
```

Expected output includes:

```text
PHASE5A_PROGRAMME_MAP_SMOKE=passed
```

### GreenComp Seed And Layer Validation

Phase 5B seeds GreenComp as the first complete evidence-informed framework layer. The seed is idempotent and can be rerun safely.

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require node scripts/seed-greencomp.mjs
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require node scripts/seed-greencomp.mjs
```

The second run should return the same object counts without duplicating records:

```text
GREENCOMP_SEED=ok
DOMAINS=4
COMPETENCIES=12
```

The GreenComp validation script creates one disposable programme, evidence item, competency evaluation and evidence link inside a transaction, then rolls back:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require node scripts/phase5b-greencomp-validation.mjs
```

Expected output includes:

```text
PHASE5B_GREENCOMP_SMOKE=passed
```

### LifeComp Seed And Layer Validation

Phase 5C seeds LifeComp as the second evidence-informed European framework layer. The seed is idempotent and can be rerun safely.

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require node scripts/seed-lifecomp.mjs
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require node scripts/seed-lifecomp.mjs
```

The second run should return the same object counts without duplicating records:

```text
LIFECOMP_SEED=ok
DOMAINS=3
COMPETENCIES=9
```

The LifeComp validation script creates one disposable programme, evidence item, competency evaluation and evidence link inside a transaction, then rolls back:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require node scripts/phase5c-lifecomp-validation.mjs
```

Expected output includes:

```text
PHASE5C_LIFECOMP_SMOKE=passed
```

### Evidence Maturity Terminology Migration

CAST now uses evidence maturity terminology for framework layers:

```text
none
developing
consolidating
leading
```

Display labels are:

```text
None
Developing
Consolidating
Leading
```

Legacy progression/scaffolding values are migrated as:

```text
not_applicable -> none
introduce      -> developing
develop        -> consolidating
integrate      -> leading
demonstrate    -> leading
```

CAST uses these values to describe curriculum evidence maturity. They are not learner attainment or learner progression claims.

### Phase 5 Multi-Framework Validation

Phase 5 seeds European frameworks as independent frameworks, lenses and programme-map layers. Seeds are idempotent and can be rerun safely.

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require pnpm run db:seed:frameworks
```

The seed should create:

```text
GreenComp  4 domains / 12 competencies
LifeComp   3 domains / 9 competencies
EntreComp  3 domains / 15 competencies
DigComp    5 domains / 21 competencies
```

Run all transaction-backed Phase 5 smoke checks:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require pnpm run db:validate:phase5
```

Expected output includes:

```text
PHASE5A_PROGRAMME_MAP_SMOKE=passed
PHASE5B_GREENCOMP_SMOKE=passed
PHASE5C_GREENCOMP_EXPECTATIONS_SMOKE=passed
PHASE5C_LIFECOMP_SMOKE=passed
PHASE5F_ENTRECOMP_SMOKE=passed
PHASE5G_DIGCOMP_SMOKE=passed
```

The validation scripts create disposable programme, structure, evidence, expectation and evaluation records inside transactions, then roll them back.
