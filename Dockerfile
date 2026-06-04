# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Target linux/amd64 explicitly — the pnpm-workspace.yaml esbuild overrides
# strip all non-linux-x64 platform packages, so cross-platform builds
# (e.g. on Apple Silicon) must still produce an amd64 image.
FROM --platform=linux/amd64 node:24-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy workspace manifests first for layer-cached dependency install.
# All packages listed in pnpm-workspace.yaml must be present so pnpm can
# resolve workspace: links in the lockfile.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./

COPY artifacts/api-server/package.json    ./artifacts/api-server/
COPY artifacts/sar-review/package.json    ./artifacts/sar-review/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY scripts/package.json                 ./scripts/
COPY lib/db/package.json                  ./lib/db/
COPY lib/api-spec/package.json            ./lib/api-spec/
COPY lib/api-zod/package.json             ./lib/api-zod/
COPY lib/api-client-react/package.json    ./lib/api-client-react/
COPY lib/integrations-openai-ai-server/package.json \
                                          ./lib/integrations-openai-ai-server/

RUN pnpm install --frozen-lockfile

# Copy all source after deps so the install layer is cached unless manifests change.
COPY . .

# 1. Build the React frontend (no PORT needed for static build; BASE_PATH=/)
# 2. Build the Express API server bundle via esbuild
RUN BASE_PATH=/ PORT=3000 NODE_ENV=production \
      pnpm --filter @workspace/sar-review run build && \
    NODE_ENV=production \
      pnpm --filter @workspace/api-server run build


# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:24-slim AS runner

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app
ENV NODE_ENV=production

# Copy workspace manifests so pnpm can install runtime-only npm deps
# (primarily pdfjs-dist, which is externalised from the esbuild bundle).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./

COPY artifacts/api-server/package.json    ./artifacts/api-server/
COPY artifacts/sar-review/package.json    ./artifacts/sar-review/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY scripts/package.json                 ./scripts/
COPY lib/db/package.json                  ./lib/db/
COPY lib/api-spec/package.json            ./lib/api-spec/
COPY lib/api-zod/package.json             ./lib/api-zod/
COPY lib/api-client-react/package.json    ./lib/api-client-react/
COPY lib/integrations-openai-ai-server/package.json \
                                          ./lib/integrations-openai-ai-server/

# Install production deps only (skips all devDependencies).
# This pulls pdfjs-dist and its transitive deps into node_modules.
RUN pnpm install --prod --frozen-lockfile

# Copy the esbuild bundle and the pre-built frontend static files.
COPY --from=builder /app/artifacts/api-server/dist  ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/sar-review/dist/public \
                                                     ./artifacts/sar-review/dist/public

# Render (and most PaaS) injects PORT at runtime; default to 10000.
ENV PORT=10000
EXPOSE 10000

# Run DB migrations before starting the server.
# Uncomment the line below and set DATABASE_URL to migrate on container start.
# RUN pnpm --filter @workspace/db run push

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
