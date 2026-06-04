# CAST — Curriculum Analysis & Structuring Tool

## Overview

CAST is a TU Dublin Arts Programme tool for analysing and structuring module descriptors. It combines AI-assisted scoring, multi-framework competence lens classification, and curriculum structure analysis into a single platform.

Built as a pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 18, Vite, TanStack Query, Wouter, Tailwind CSS
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`^3.25`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle for server), Vite (frontend)
- **AI**: OpenAI (GPT-4o-mini for classification, text-embedding-3-small for structure)

## Monorepo Structure

```text
/
├── artifacts/
│   ├── api-server/         # Express 5 API + static SPA serving
│   └── sar-review/         # React frontend (Vite)
├── lib/
│   ├── api-spec/           # OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/   # Generated TanStack Query hooks
│   ├── api-zod/            # Generated Zod schemas + TypeScript interfaces
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # One-off utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json      # Shared: composite, bundler resolution, es2022
└── tsconfig.json           # Root project references (libs only)
```

## Routing Architecture

All traffic routes through `api-server` (Express on port 8080, `paths=["/"]`):
- **`/api/*`** — handled by Express routes
- **`/assets/*`** — served as static files from `artifacts/sar-review/dist/public/`
- **Everything else** — SPA fallback serves `index.html`

The Vite dev server runs on port 22052 but is not proxied; the built static files are served by Express in both dev and production. To pick up frontend changes, rebuild with `pnpm --filter @workspace/sar-review run build`.

## TypeScript & Composite Projects

- **Always typecheck from the root** — `pnpm run typecheck` runs `tsc --build --emitDeclarationOnly` for libs, then `tsc --noEmit` for leaf packages.
- **`emitDeclarationOnly`** — `.d.ts` files only; actual bundling is done by esbuild/Vite.
- **Project references** — leaf packages (artifacts, scripts) must list their lib dependencies in `tsconfig.json` `references`.
- **`api-zod` note** — `src/index.ts` uses `export *` for Zod schemas and `export type { ... }` for named interfaces only (to avoid TS2308 name collisions between Zod const exports and TypeScript interface exports of the same names).

## Root Scripts

- `pnpm run build` — typechecks libs then runs `build` in all packages that define it
- `pnpm run typecheck` — full workspace typecheck
- `pnpm run typecheck:libs` — builds lib declarations only (`tsc --build`)
- `pnpm --filter @workspace/api-spec run codegen` — regenerates `api-client-react` and `api-zod` from `openapi.yaml`
- `pnpm --filter @workspace/db run push` — push schema changes to dev DB

---

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Serves the React SPA as static files in addition to the API.

- `src/index.ts` — reads `PORT`, starts Express
- `src/app.ts` — CORS, JSON parsing, static file serving, SPA fallback, routes at `/api`
  - Uses `import.meta.url`-relative path to locate `artifacts/sar-review/dist/public/` (works regardless of `cwd`)
  - Static middleware runs before the API router; SPA catch-all runs after
- `src/routes/` — all route handlers
- Dev: `pnpm --filter @workspace/api-server run dev` (builds bundle first, then starts)
- Build: `pnpm --filter @workspace/api-server run build` → `dist/index.mjs`
- Production run: `node --enable-source-maps artifacts/api-server/dist/index.mjs` (from workspace root)

### `artifacts/sar-review` (`@workspace/sar-review`)

React SPA built with Vite. Uses TanStack Query for data fetching and Wouter for routing.

- Build: `pnpm --filter @workspace/sar-review run build` → `dist/public/`
- Dev: `pnpm --filter @workspace/sar-review run dev` (Vite dev server on port 22052, not proxied)
- Depends on: `@workspace/api-client-react`, `@workspace/api-zod`

### `lib/db` (`@workspace/db`)

Drizzle ORM + PostgreSQL. Tables:

| Table | Purpose |
|---|---|
| `module_reviews` | Primary module store — raw text, metadata, SAR results, Free Elective analysis, embeddings |
| `programmes` | Academic programme definitions (name, code) |
| `programme_modules` | Module↔Programme join — stage, semester, core/option flags |
| `ga_classifications` | **Multi-lens table** — stores `ga`, `greencomp`, `digcomp` classification records. `programme_id IS NULL` = module-level canonical; `programme_id = N` = programme-specific override |
| `audit_logs` | Admin action and AI processing event log |

### `lib/api-spec` (`@workspace/api-spec`)

Owns `openapi.yaml` and `orval.config.ts`. Codegen targets:
1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas (`api.ts`) + TypeScript interfaces (`types/`)

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas and TypeScript interfaces from the OpenAPI spec. Used by `api-server` for validation and by `sar-review` for TypeScript types.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated TanStack Query hooks and fetch client (e.g. `useListModules`, `useGetModule`).

---

## Application Features

### Frontend Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | Home | Landing page |
| `/upload` | Upload | Module intake — PDF, Excel, or manual entry |
| `/modules/:id/extract` | Extract | AI-assisted field extraction from raw text |
| `/modules/:id` | Review | SAR scoring, criterion override, Free Elective panel |
| `/sar` | Sar | SAR listing and selection |
| `/dashboard` | Dashboard | SAR status metrics |
| `/sar-analytics` | SarAnalytics | Detailed SAR distribution charts |
| `/summary` | Summary | Suite-wide analytics (SAR, GA, GreenComp, DigComp, Free Electives) |
| `/free-electives` | FreeElectives | Free Elective suitability dashboard |
| `/structure` | Structure | Lexical + semantic module similarity explorer |
| `/assessment` | Assessment | Assessment-type analysis |
| `/modality` | Modality | Delivery modality analysis |
| `/programme` | Programme | Programme list |
| `/programme/catalogue` | ModuleCatalogue | Global module view with all lens coverage |
| `/programme/ga` | GaDashboard | Graduate Attributes lens dashboard |
| `/programme/greencomp` | GreenCompDashboard | GreenComp sustainability lens dashboard |
| `/programme/digcomp` | DigCompDashboard | DigComp 3.0 digital competence lens dashboard |
| `/programme/import` | ProgrammeImport | Bulk CSV/Excel programme structure import |
| `/about` | About | Tool documentation |
| `/admin/login` | Login | Admin authentication |

### API Endpoints (all under `/api`)

**Modules**
- `GET /modules` — list with filters (SAR, stage, band, campus, etc.)
- `POST /modules` — create module
- `POST /modules/batch` — bulk upsert with programme auto-wiring
- `GET/PATCH/DELETE /modules/:id` — get, update, delete
- `POST /modules/:id/classify` — AI SAR classification
- `POST /modules/:id/score` — AI criterion scoring (1–4)
- `POST /modules/:id/extract-fields` — AI field extraction
- `POST /modules/:id/analyze-free-elective` — AI Free Elective analysis
- `POST /modules/parse-pdf` / `parse-excel` — file parsing utilities

**Structure**
- `GET /structure/modules` — lightweight list for explorer
- `GET /structure/overview` — TF-IDF + semantic readiness stats
- `GET /structure/embeddings/status` — embedding generation progress
- `POST /structure/embeddings/generate` — trigger OpenAI embedding generation
- `GET /structure/clusters` — graph-based module clusters
- `GET /structure/similar/:id` — similar modules lookup
- `GET /structure/outliers` — modules with weakest relationships
- `GET /structure/network/:id` — node graph data
- `DELETE /structure/cache` — clear similarity cache

**Programme Mapping**
- `GET/POST /programme-mapping/programmes` — list / create programmes
- `GET /programme-mapping/programmes/:id` — programme + modules + lens overrides (inheritance applied)
- `PATCH /programme-mapping/programmes/:id/ga` — upsert GA/GreenComp/DigComp level for a programme
- `POST /programme-mapping/programmes/:id/ga/auto-classify` — batch AI lens analysis for a programme
- `POST /programme-mapping/import-structure` — import programme structure from CSV/Excel

**Module Catalogue & Lenses**
- `GET /module-catalogue` — global view with lens coverage
- `PATCH /module-catalogue/:moduleId/ga` — set canonical (module-level) lens classification
- `POST /module-catalogue/:lens/batch-classify` — system-wide background AI lens analysis

**Analytics & Export**
- `GET /dashboard/summary` — SAR processing metrics
- `GET /cast-overview` — aggregated stats: SAR, Free Electives, GA, GreenComp, DigComp
- `GET /sar-definitions` — SAR framework metadata
- `GET /export/csv` — full module dataset as CSV
- `GET /export/decision-workbook` — combined XLSX for SAR + Free Elective strong fits

**Auth & System**
- `POST /auth/login` / `GET /auth/me` — session-based admin auth
- `GET /audit-logs` — system action history
- `GET /healthz` — health check (used by deployment)

### Lens Classification Architecture

All three competence lenses share the `ga_classifications` table with a `lens` discriminator column.

**Inheritance model:**
- `programme_id IS NULL` → module-level canonical classification (set in Module Catalogue, propagates to all programmes as `inherited: true`)
- `programme_id = N` → programme-specific override (wins over inherited value)
- Saving in a Classify view only writes non-inherited cells, keeping inheritance live

**Lens areas:**

| Lens | Areas / Domains |
|---|---|
| **GA** | People, Planet, Partnership |
| **GreenComp** | Values, Complexity, Futures, Action |
| **DigComp 3.0** | Information, Communication, Content Creation, Safety & Wellbeing, Problem Solving |

**Levels (all lenses):** None → Developing → Consolidating → Leading

### Summary Analytics Page (`/summary`)

Aggregates all lenses in a single call to `GET /api/cast-overview`. Displays:
- Six top-row tool tiles: SAR Review, Structure, Programme Map, Grad. Attributes, GreenComp, DigComp
- Module Corpus card, SAR Score Distribution donut, SAR Area Coverage bars
- GA Lens card, GreenComp Lens card, DigComp 3.0 Lens card (3-column grid on xl screens)
- Programme Mapping Readiness
- Free Elective Analysis summary
- Auto-generated Strategic Insights (coverage-aware language, no achievement claims)

### Free Elective Analysis

AI pipeline (`POST /modules/:id/analyze-free-elective`) that classifies modules for non-major suitability:
- 7 Discipline Families (Business & Enterprise, Society/Culture/Humanities, etc.)
- Scores: Accessibility (primary), Stage Appropriateness, Breadth & Transferability (1–4 each)
- Suitability Band: Recommended / Acceptable / Use With Caution / Not Suitable
- Advising tags: Explore, Useful Skills, Pathway Support

### Structure Explorer (`/structure`)

Dual-engine similarity analysis:
- **Lexical (TF-IDF)**: Fast, local, no API cost
- **Semantic (OpenAI embeddings)**: `text-embedding-3-small`, stored as JSON in `module_reviews.embedding`
- Outputs: clusters, outlier detection, per-module similarity graph, network visualisation

---

## Development Notes

- **Never run `pnpm run dev` at the workspace root** — artifacts need `PORT` wired by workflows
- **Frontend changes require a rebuild** — run `pnpm --filter @workspace/sar-review run build` then restart the api-server workflow to serve the updated static files
- **Schema changes** — `pnpm --filter @workspace/db run push` in dev; production migrations are handled by Replit on publish
- **Codegen** — after editing `openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` then restart the api-server workflow
- **Zod versions** — workspace uses Zod `^3.25`; `@hookform/resolvers` types against Zod `4.x`, so `zodResolver(schema as any)` is used in form pages to silence the type-level incompatibility (runtime behaviour is unaffected)
