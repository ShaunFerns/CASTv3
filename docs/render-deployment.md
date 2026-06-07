# CAST v3 Render Deployment

CAST v3 deploys to Render as a single Node web service backed by the existing Supabase PostgreSQL database.

Do not provision Render PostgreSQL for the approved CAST v3 deployment path.

## Topology

```text
Browser -> Render web service -> CAST API -> Supabase PostgreSQL
```

The browser must not directly mutate CAST v3 tables. Supabase Auth and broad RLS are not implemented in this deployment phase.

## Render Blueprint

`render.yaml` defines only the `cast-v3` web service.

It does not define a Render managed PostgreSQL database.

The service build command:

```bash
corepack enable &&
corepack prepare pnpm@10.26.1 --activate &&
pnpm install --frozen-lockfile &&
BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/sar-review run build &&
NODE_ENV=production pnpm --filter @workspace/api-server run build
```

The pre-deploy command:

```bash
corepack enable &&
corepack prepare pnpm@10.26.1 --activate &&
node scripts/apply-migrations.mjs &&
node scripts/seed-greencomp.mjs &&
node scripts/seed-lifecomp.mjs
```

The start command:

```bash
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

The health check path:

```text
/api/healthz
```

## Required Environment Variables

Set these in the Render dashboard or an attached environment group:

```bash
NODE_ENV=production
NODE_VERSION=24.14.1
BASE_PATH=/
LOG_LEVEL=info
CAST_V3_PREVIEW_BRIDGE=false
DATABASE_URL=postgresql://...
SESSION_SECRET=<long-random-secret-at-least-32-characters>
ADMIN_USERNAME=<admin-username>
ADMIN_PASSWORD=<admin-password>
AI_INTEGRATIONS_OPENAI_API_KEY=<openai-api-key>
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
```

Optional:

```bash
CAST_ALLOWED_ORIGINS=https://your-render-service.onrender.com
```

Leave `CAST_ALLOWED_ORIGINS` unset for same-origin Render deployment. Set it only when an approved external origin needs credentialed API access.

Do not add Supabase service-role keys or database passwords to the frontend. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are not required by the current CAST v3 Render deployment.

## Database Migrations

`scripts/apply-migrations.mjs` applies only the core CAST v3 migrations:

- `0001_phase2a_foundation.sql`
- `0002_phase2b_source_imports.sql`
- `0003_phase2c_curated_curriculum.sql`
- `0004_phase2d_evidence_framework.sql`
- `0005_phase2e_ai_review_improvement.sql`
- `0006_phase2f_review_readiness_action.sql`
- `0007_phase2g_data_quality_local_workers.sql`
- `0008_phase3b_identity_sessions_roles.sql`
- `0009_phase4a_curriculum_ingestion.sql`

The runner creates `cast_schema_migrations` and records each migration with:

- migration id
- filename
- checksum
- status: `applied` or `baselined`
- timestamp
- execution time

If the existing Supabase database already contains all expected objects for a migration but the ledger has not yet been created, the runner records the migration as `baselined`. This supports the already-validated Supabase database without re-running duplicate DDL.

If a recorded migration checksum changes, the runner stops.

`0090_legacy_compatibility_views.sql` is not run by default. It is optional and should only be used in prototype migration environments where the legacy tables exist.

Dry run:

```bash
node scripts/apply-migrations.mjs --dry-run
```

## Framework Seeds

The European framework seed scripts run after migrations:

- `scripts/seed-greencomp.mjs`
- `scripts/seed-lifecomp.mjs`
- `scripts/seed-entrecomp.mjs`
- `scripts/seed-digcomp.mjs`

The seeds are idempotent and safely create or update:

- GreenComp framework
- GreenComp 2022 framework version
- 4 competence areas
- 12 competences
- GreenComp curriculum evidence lens
- LifeComp framework
- LifeComp 2020 framework version
- 3 competence areas
- 9 competences
- LifeComp curriculum evidence lens
- EntreComp framework
- EntreComp 2016 framework version
- 3 competence areas
- 15 competences
- EntreComp curriculum evidence lens
- DigComp framework
- DigComp 3.0 framework version
- 5 competence areas
- 21 competences
- DigComp curriculum evidence lens
- lens version, binding, evidence rules and output schema

Running the seeds repeatedly must not create duplicate framework records.

## Session And Proxy Behaviour

The API server sets `trust proxy` before session middleware so secure cookies work behind Render HTTPS.

`SESSION_SECRET` must be present, at least 32 characters long, and not a known development placeholder when `NODE_ENV=production`.

Sessions are stored in PostgreSQL using `app_sessions`, which is created by `0008_phase3b_identity_sessions_roles.sql`.

## CORS Behaviour

Development keeps permissive CORS for local testing.

Production does not reflect arbitrary origins. Same-origin Render traffic does not require CORS. Set `CAST_ALLOWED_ORIGINS` only for explicitly approved external origins.

## Preview Bridge

The CAST v3 preview bridge remains in the codebase for development and preview use.

It is disabled by default and ignored when `NODE_ENV=production`, even if `CAST_V3_PREVIEW_BRIDGE=true`.

Do not use the preview bridge as production authentication.

## Frontend Routing

The frontend is built with `BASE_PATH=/`.

The Express API server serves the built frontend and falls back to `index.html` for non-API routes, so direct links such as `/ingestion`, `/programme/workspace` and `/programme/map` work under the Render web service.

## Deployment Checklist

1. Confirm the Supabase `DATABASE_URL` points to the intended database.
2. Confirm all Render secrets are configured.
3. Confirm `CAST_V3_PREVIEW_BRIDGE=false`.
4. Deploy from the branch containing `render.yaml`.
5. Confirm pre-deploy migrations complete.
6. Confirm framework seeds complete.
7. Confirm `/api/healthz` returns `200`.
8. Confirm a frontend deep link returns the React app.
9. Confirm production session cookies persist after login.
10. Confirm secured CAST v3 APIs require a valid CAST v3 session.
