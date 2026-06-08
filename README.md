# CAST

**Curriculum Analysis and Strategy Tool**

CAST is an evidence-informed curriculum intelligence and enhancement platform for higher education.

CAST helps programme teams turn curriculum evidence into structured understanding, review-ready insight and practical enhancement action. The platform is being evolved from an early Replit prototype into a production-ready CAST v3 product for programme review, validation, revalidation, accreditation, curriculum enhancement, DELTA-style readiness, SWOT analysis and action planning.

## Core Components

CAST v3 is organised around seven core components:

1. **Upload Curriculum**
   Import curriculum evidence from Akari-compatible CSV/XLSX exports, module descriptor PDFs, text extracts and manual module entry.

2. **Programme Workspace**
   Reconcile source programme/module data into curated programme versions, structures, stages, semesters, pathways, option groups and module placements.

3. **Programme Map**
   Visualise the curated programme structure as the base map, with switchable evidence-informed overlays for frameworks, programme attributes, assessment, data quality and future accreditation layers.

4. **Framework Hub**
   Manage and explain framework/lens layers including GreenComp, LifeComp, EntreComp, DigComp, programme-owned attributes, disciplinary frameworks and professional standards.

5. **Module Builder**
   Foundation for module-level enhancement support, including Modality, UDL, Assessment Design and Framework Alignment. Module Builder is where future descriptor improvement workflows should live.

6. **Review & Enhancement**
   Foundation for readiness checks, SWOT, action planning, review cycles and monitored enhancement activity.

7. **Data Quality**
   Surface missing, incomplete, duplicated, stale or weak curriculum data without silently cleaning or overwriting source evidence.

## Operating Model

CAST v3 follows the workflow:

```text
Evidence -> Analyse -> Insights -> Review -> Act
```

The architecture separates different kinds of work:

- **Programme Map** answers: what exists across the curriculum?
- **Module Builder** answers: how should this module be improved?
- **Review & Enhancement** answers: what should we do next?

Assessment remains a Programme Map layer because assessment balance, diversity, clustering and workload are programme-level design concerns. Modality and UDL are positioned inside Module Builder as module-level design supports, with possible future programme-level aggregation.

## Current Status

CAST v3 is in active transformation.

Completed foundation work includes:

- production foundation outside Replit
- validated Supabase/PostgreSQL database baseline
- persistent sessions, roles, permissions and tenant-aware API middleware
- audit writer and security event logging
- curriculum ingestion pipeline
- curated programme workspace
- development preview bridge
- programme map and framework/lens architecture
- GreenComp, LifeComp, EntreComp and DigComp seeds
- CAST evidence maturity terminology: None, Developing, Consolidating, Leading
- Assessment curriculum design layer
- Module Builder, Review & Enhancement and Data Quality navigation foundations
- Render deployment hardening using Supabase PostgreSQL

Legacy prototype workflows remain temporarily in the repository, including earlier SAR, Free Electives, Structure Explorer and prototype administration functionality. New work should be CAST v3-first.

## Local Development

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Create an environment file:

```bash
cp .env.example .env
```

Set at minimum:

```bash
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/cast
AI_INTEGRATIONS_OPENAI_API_KEY=sk-your-openai-key
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
SESSION_SECRET=replace-with-a-long-random-string-at-least-32-chars
CAST_BOOTSTRAP_ADMIN_EMAIL=admin@example.edu
CAST_BOOTSTRAP_ADMIN_NAME="CAST Bootstrap Admin"
CAST_BOOTSTRAP_ADMIN_PASSWORD=replace-with-a-strong-password
CAST_BOOTSTRAP_INSTITUTION_NAME="CAST Preview Institution"
CAST_BOOTSTRAP_INSTITUTION_SLUG=cast-preview
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
```

Run type checks:

```bash
pnpm run typecheck
```

Build the frontend:

```bash
BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/sar-review run build
```

Build the backend:

```bash
NODE_ENV=production pnpm --filter @workspace/api-server run build
```

More detailed setup notes are in [docs/local-development.md](docs/local-development.md).

## Database And Seeds

CAST v3 uses PostgreSQL with Drizzle schema definitions and SQL migrations.

Apply migrations:

```bash
node scripts/apply-migrations.mjs
```

Seed framework and design layers:

```bash
pnpm run db:seed:frameworks
```

Fresh CAST v3 deployments do not require legacy prototype tables. Optional legacy compatibility views are separate and should only be used during prototype migration.

## Supabase Notes

The production database target is Supabase PostgreSQL. The browser should not directly mutate CAST v3 tables; browser requests should go through the CAST API.

Important rules:

- apply migrations in order
- validate schema changes against a disposable or controlled database first
- do not seed real institutional data into smoke tests
- treat uploaded documents, extracted text, source exports and analysis outputs as sensitive curriculum data
- keep RLS planning separate until the API/session foundation is fully ready

## Bootstrap Access

CAST v3 secured routes require a CAST identity session and institution context. Until full Supabase Auth/OIDC is implemented, CAST uses a temporary production bootstrap admin login.

The `/admin/login` screen authenticates the configured bootstrap admin and then creates or reuses:

- institution
- user
- institution membership
- institution-admin role
- membership role assignment

The login stores `castUserId` and `selectedInstitutionId` in the server-side session, so `/api/security/context`, Upload Curriculum, Programme Workspace, Programme Map, Framework Hub and Module Builder can use the normal Phase 3B middleware path.

Configure:

```bash
CAST_BOOTSTRAP_ADMIN_EMAIL=admin@example.edu
CAST_BOOTSTRAP_ADMIN_NAME="CAST Bootstrap Admin"
CAST_BOOTSTRAP_ADMIN_PASSWORD=replace-with-a-strong-password
CAST_BOOTSTRAP_INSTITUTION_NAME="CAST Preview Institution"
CAST_BOOTSTRAP_INSTITUTION_SLUG=cast-preview
```

In production, `CAST_BOOTSTRAP_ADMIN_PASSWORD` must be at least 16 characters and include uppercase, lowercase, number and symbol characters. `SESSION_SECRET` must be at least 32 characters and must not use a placeholder.

Legacy `/api/auth/*` admin login remains for legacy prototype routes only. Do not use `CAST_V3_PREVIEW_BRIDGE` as the CAST v3 access model.

## Render Deployment

CAST v3 is configured for Render as a web service using the existing Supabase PostgreSQL database. Do not provision Render Postgres for the current deployment path.

Render should provide:

- `DATABASE_URL`
- `SESSION_SECRET`
- `CAST_BOOTSTRAP_ADMIN_EMAIL`
- `CAST_BOOTSTRAP_ADMIN_NAME`
- `CAST_BOOTSTRAP_ADMIN_PASSWORD`
- `CAST_BOOTSTRAP_INSTITUTION_NAME`
- `CAST_BOOTSTRAP_INSTITUTION_SLUG`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `BASE_PATH=/`
- `NODE_ENV=production`
- `CAST_V3_PREVIEW_BRIDGE=false`

See [docs/render-deployment.md](docs/render-deployment.md).

## Key Documentation

- [Local development](docs/local-development.md)
- [Repository audit](docs/repository-audit.md)
- [CAST v3 architecture](docs/cast-v3-architecture.md)
- [Post-Phase 5 architecture](docs/cast-v3-post-phase5-architecture.md)
- [CAST v3 schema summary](docs/cast-v3-schema-summary.md)
- [CAST v3 roadmap](docs/cast-v3-roadmap.md)
- [Phase 3B identity and sessions](docs/cast-v3-phase3b-identity-sessions.md)
- [Render deployment](docs/render-deployment.md)

## Security Warning

Do not commit:

- secrets or `.env` files
- Supabase service-role keys
- database passwords
- production data
- uploaded documents
- source-system exports
- extracted text from real institutional documents
- database dumps
- generated reports containing confidential curriculum or staff data

Real data should only be used in approved, secured environments with appropriate institutional permissions.
