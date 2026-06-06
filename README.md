# CAST v3

CAST stands for **Curriculum Analysis, Strategy and Transformation**.

CAST v3 is a curriculum intelligence and evidence platform for higher education. It is being evolved from a Replit prototype into a production-ready platform that helps programme teams collect evidence, understand curriculum structure, analyse frameworks and lenses, improve descriptors, prepare for review and validation, and plan enhancement activity.

## Product Purpose

CAST helps higher education teams move from fragmented curriculum documentation to evidence-informed curriculum insight and action.

The platform is designed to support:

- programme review
- validation and revalidation
- accreditation
- curriculum enhancement
- DELTA readiness
- SWOT analysis
- action planning
- evidence-linked curriculum intelligence

CAST v3 is programme-led and evidence-first. AI outputs are treated as claims that must remain linked to evidence and open to human review. Descriptor improvement is supported without overwriting institutional truth.

## Current Status

CAST v3 is in active transformation.

The current repository still contains legacy prototype workflows, including earlier SARs, Free Electives and Structure Explorer functionality. Those workflows remain temporarily available while the new CAST v3 foundation is built beside them.

All new development should be **CAST v3-first**:

- tenant-aware
- evidence-linked
- database-backed
- auditable
- compatible with Supabase/PostgreSQL
- designed for higher education programme teams

## Completed Milestones

The following foundation milestones have been completed:

- **Production foundation**: Replit-specific assumptions were isolated or removed, standard PNPM setup was restored, local build commands were documented, and the app can run outside Replit.
- **Validated Supabase database**: CAST v3 migrations through Phase 4A have been validated against Supabase using a direct database connection.
- **Security/session foundation**: Phase 3B introduced persistent PostgreSQL sessions, canonical roles and permissions, programme memberships, tenant-aware request context middleware, and audit event infrastructure.
- **Curriculum ingestion pipeline**: Phase 4A added ingestion scaffolding for institutional imports, single descriptor uploads/text, and manual module entry, with evidence materialisation and data quality checks.
- **Curated programme workspace**: Phase 4B added source-to-curated programme version creation, reconciliation, editable curated structures, source comparison, data quality checks, and map-preview projection.
- **Development preview bridge**: Phase 4C added a development-only bridge so the legacy admin login can create a real CAST v3 session context for safe local preview of secured CAST v3 screens.

## Run Locally

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
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
```

Run the frontend:

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/sar-review run dev
```

Run the API server:

```bash
PORT=3000 NODE_ENV=development pnpm --filter @workspace/api-server run dev
```

Build the frontend:

```bash
BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/sar-review run build
```

Build the backend:

```bash
NODE_ENV=production pnpm --filter @workspace/api-server run build
```

Run type checks:

```bash
pnpm run typecheck
```

More detailed setup notes are in [docs/local-development.md](docs/local-development.md).

## Preview Mode

CAST v3 secured routes require a Phase 3B CAST identity session and institution context. During development only, the preview bridge can connect the existing legacy admin login to a seeded CAST v3 preview user and institution.

Enable it only in local or preview environments:

```bash
CAST_V3_PREVIEW_BRIDGE=true
CAST_V3_PREVIEW_INSTITUTION_SLUG=cast-preview
CAST_V3_PREVIEW_INSTITUTION_NAME="CAST Preview Institution"
CAST_V3_PREVIEW_USER_EMAIL=preview-admin@cast.local
CAST_V3_PREVIEW_USER_NAME="CAST Preview Admin"
```

Safety rules:

- The bridge is disabled by default.
- The bridge is ignored when `NODE_ENV=production`.
- It does not bypass Phase 3B middleware.
- It creates or reuses real preview institution, user, membership and role records.
- It stores `castUserId` and selected institution context in the existing session only after a successful legacy admin login.
- It writes an audit event for bridge-based session creation.

With preview mode enabled, local testers can use:

- `/api/security/context`
- `/ingestion`
- `/programme/workspace`
- `/api/ingestion/*`
- `/api/programme-workspace/*`

Do not use preview mode as production authentication.

## Database And Supabase Notes

CAST v3 uses PostgreSQL with Drizzle schema definitions and SQL migrations.

Fresh CAST v3 deployments do not require legacy prototype tables. Optional legacy compatibility views are kept separate and are only for prototype migration environments.

Supabase validation has confirmed the clean production baseline and the CAST v3 Phase 4A ingestion tables. Supabase MCP migration application was not used for final validation where direct database validation was required; direct `DATABASE_URL` validation was used instead.

Key database expectations:

- Apply core migrations in order.
- Use a disposable database for migration testing before shared environments.
- Do not seed real institutional data into development or smoke-test databases.
- Treat uploaded documents, extracted text, source exports and analysis outputs as sensitive curriculum data.
- Use the API server as the browser boundary; the browser should not mutate CAST v3 tables directly.

## Key Documentation

- [Local development](docs/local-development.md)
- [Repository audit](docs/repository-audit.md)
- [CAST v3 architecture](docs/cast-v3-architecture.md)
- [CAST v3 schema summary](docs/cast-v3-schema-summary.md)
- [CAST v3 roadmap](docs/cast-v3-roadmap.md)
- [Phase 3B identity and sessions](docs/cast-v3-phase3b-identity-sessions.md)

## Legacy Status

Legacy workflows remain temporarily in the repository so existing prototype functionality is not broken during the transition.

Legacy areas include earlier SARs, Free Electives, Structure Explorer and prototype administration flows. These should be treated as migration-era functionality. New work should use the CAST v3 domain model, tenant-aware API services, audit writer, and evidence-first curriculum pipeline.

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
