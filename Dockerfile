# =============================================================================
# NexTool — production Dockerfile for the Next.js app (web + API).
#
# Multi-stage build:
#   1. deps   — install all dependencies (cacheable)
#   2. builder — compile the standalone Next.js server
#   3. runtime — minimal image with only the standalone server + public assets
#
# The runtime image runs as a non-root user (nextool). It does NOT include:
#   - LibreOffice / FFmpeg / Tesseract / Ghostscript — those live in the
#     worker images (see Dockerfile.worker). The web container only serves
#     HTTP + handles API requests.
#   - Source code (only the compiled .next/standalone output)
#   - Dev dependencies
#
# Build:
#   docker build -t nextool-app:latest .
#
# Run:
#   docker run -p 3000:3000 --env-file .env nextool-app:latest
# =============================================================================
FROM oven/bun:1 AS deps
WORKDIR /app

# Install OS deps needed by sharp + Prisma (libc6-compat on alpine variants).
# We're on the debian-based oven/bun:1 image here, so most libs are present.

# Copy lockfile + package manifests first (better caching)
COPY package.json bun.lock* ./
COPY prisma ./prisma

# Install all deps (including devDeps needed by the build)
RUN bun install --frozen-lockfile || bun install

# ---------------------------------------------------------------------------
# Stage 2: builder
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env (no secrets — these are only public build vars)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma client + build the Next.js standalone server.
# `next build` produces .next/standalone/ when output: "standalone" is set.
RUN bunx prisma generate
RUN bun run build

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS runtime
WORKDIR /app

# Install runtime OS deps:
#   - wget for the healthcheck (curl not in alpine by default)
#   - libc6-compat for native modules (sharp, prisma engine)
#   - tini for proper PID-1 signal handling
RUN apk add --no-cache wget libc6-compat tini \
  && addgroup -S -g 1001 nextool \
  && adduser -S -D -H -u 1001 -G nextool nextool

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone server + static assets + public dir (per Next.js docs).
COPY --from=builder --chown=nextool:nextool /app/.next/standalone ./
COPY --from=builder --chown=nextool:nextool /app/.next/static ./.next/static
COPY --from=builder --chown=nextool:nextool /app/public ./public

# Copy Prisma schema + migrations so the runtime can run `prisma migrate`.
COPY --from=builder --chown=nextool:nextool /app/prisma ./prisma
COPY --from=builder --chown=nextool:nextool /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextool:nextool /app/node_modules/@prisma ./node_modules/@prisma

# Storage dirs (the local storage provider writes here when STORAGE_* is unset).
RUN mkdir -p tmp/uploads tmp/outputs tmp/quarantine tmp/exports \
  && chown -R nextool:nextool tmp

USER nextool

EXPOSE 3000

# tini handles SIGTERM/SIGINT properly so Next.js can drain in-flight requests.
ENTRYPOINT ["/sbin/tini", "--"]

# Healthcheck — hits the readiness probe (Prisma `SELECT 1`).
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
  CMD wget -qO- http://localhost:3000/api/ready || exit 1

CMD ["node", "server.js"]
