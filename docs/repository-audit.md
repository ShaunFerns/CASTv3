# CAST v3 Repository Audit

CAST v3 currently starts from the CAST Replit prototype. The immediate goal is to make the foundation portable before changing product functionality.

## Confirmed Frameworks

- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS 4, Radix UI, TanStack Query, Wouter.
- Backend: Node.js 24, Express 5, TypeScript bundled with esbuild.
- Database: PostgreSQL through Drizzle ORM and `pg`.
- API contracts: OpenAPI in `lib/api-spec`, generated clients in `lib/api-client-react` and `lib/api-zod`.
- Deployment assets: Render Blueprint and Dockerfile.

## Replit-Specific Surface

Replit-specific files and configuration:

- `.replit`
- `.replitignore`
- `replit.md`
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`
- `@replit/vite-plugin-runtime-error-modal`
- `REPL_ID` checks in Vite configs
- Replit-style OpenAI environment variable names: `AI_INTEGRATIONS_OPENAI_*`
- PNPM platform-pruning overrides labelled as Replit/Linux-specific

Current status:

- The main production frontend config loads Replit Vite plugins conditionally when `REPL_ID` exists.
- The mockup sandbox is not part of the production CAST app. Its Vite config now defaults `PORT` and `BASE_PATH` outside Replit and loads Replit plugins only when `REPL_ID` exists.
- The OpenAI variable names are coupled to the prototype integration and should be wrapped before renaming.
- The Replit/Linux PNPM platform-pruning overrides have been removed, and the lockfile has been regenerated with PNPM 10.26.1.

## Build Commands

Frontend:

```bash
BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/sar-review run build
```

Backend:

```bash
NODE_ENV=production pnpm --filter @workspace/api-server run build
```

Workspace:

```bash
pnpm run typecheck
pnpm run build
```

Production start:

```bash
PORT=3000 NODE_ENV=production node --enable-source-maps artifacts/api-server/dist/index.mjs
```

## Database Requirements

- PostgreSQL is required.
- `DATABASE_URL` must be set for the API and Drizzle.
- Current schema is pushed with `pnpm --filter @workspace/db run push`.
- Render currently uses `push-force` in `render.yaml`; this is acceptable for prototype deployment but should be replaced with controlled migrations before production.

Current tables:

- `module_reviews`
- `programmes`
- `programme_modules`
- `ga_classifications`
- `audit_logs`

## Environment Files

Clean example files now exist:

- `.env.example`
- `artifacts/api-server/.env.example`
- `artifacts/sar-review/.env.example`

Real `.env` files are ignored.

## Files That Should Not Be Committed

- `.env`, `.env.*` except `.env.example`
- `node_modules`
- `dist`
- `.cache`, `.local`
- `uploads`, `tmp`, `temp`
- generated exports such as `.xlsx` and `.csv`
- logs
- database dumps
- private keys and certificates

## Render or Equivalent Deployment Plan

Minimum production-like deployment:

1. Provision managed PostgreSQL.
2. Set `DATABASE_URL`, `PORT`, `NODE_ENV=production`, `BASE_PATH=/`.
3. Set OpenAI variables.
4. Set `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
5. Build frontend and backend.
6. Run database schema step.
7. Start `artifacts/api-server/dist/index.mjs`.
8. Use `/api/healthz` as the health check.

Render Blueprint support already exists in `render.yaml`.

Before production:

- Replace `push-force` with explicit migrations.
- Replace default session storage with a persistent store.
- Replace single-admin auth with institution-ready auth/RBAC.
- Add object storage for uploaded files and exports.
- Add queue-backed AI processing.
- Add backup, audit, logging, and monitoring policies.

## Verification Notes

In this audit environment:

- `pnpm install --lockfile-only` completed.
- `pnpm install --frozen-lockfile` completed.
- `pnpm --filter @workspace/api-spec run codegen` completed.
- `pnpm run typecheck` completed.
- `BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/sar-review run build` completed.
- `NODE_ENV=production pnpm --filter @workspace/api-server run build` completed.
- `PORT=4177 NODE_ENV=production node --enable-source-maps artifacts/api-server/dist/index.mjs` started outside Replit.
- `GET http://127.0.0.1:4177/api/healthz` returned `200 {"status":"ok"}`.
- `GET http://127.0.0.1:4177/` returned the built React `index.html`.
- The local shell's default `node.exe` was blocked, so verification used the bundled Codex Node runtime, which reports Node `v24.14.0`.
- PNPM was not available on PATH, so verification used a downloaded PNPM `10.26.1` Windows binary under `work/.tools`.

Phase 2A database validation status:

- Validation SQL has been added for Phase 2A object checks and insert/read smoke tests:
  - `lib/db/validation/phase2a_verify_objects.sql`
  - `lib/db/validation/phase2a_smoke.sql`
- This desktop environment does not currently have `psql`, Docker, Podman, a WSL Linux distribution, a PostgreSQL Windows service, or a `DATABASE_URL`.
- Because no disposable PostgreSQL database is available in this environment, `0001_phase2a_foundation.sql` has not yet been applied to a live PostgreSQL database here.
- Before Phase 2B, run the disposable database process in `docs/local-development.md` and record the actual results.

## Safest Migration Path

1. Stabilize local development and deployment without changing product behavior.
2. Add tests around import, classification, programme mapping, and exports.
3. Introduce production migrations.
4. Add persistent sessions and deployment-ready secrets handling.
5. Add object storage and stop relying on local filesystem assumptions.
6. Add a queue/worker boundary for AI and long-running analysis.
7. Introduce CAST v3 domain entities alongside the existing schema.
8. Migrate screens and APIs incrementally from module-centric prototype tables to the programme-led evidence model.
