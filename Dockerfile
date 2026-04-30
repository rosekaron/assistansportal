# syntax=docker/dockerfile:1.6

# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Layer: root lockfile (invalidates only when root package-lock.json changes)
COPY package.json package-lock.json ./
RUN npm ci

# Layer: server lockfile (invalidates only when server/package-lock.json changes)
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server

# Layer: client lockfile (invalidates only when client/package-lock.json changes)
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client

# Copy source (after deps so source-only changes don't trigger reinstall)
COPY server/ ./server/
COPY client/ ./client/

# Build: client first (Vite → client/dist), then server (tsc → server/dist)
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app

# System packages: qpdf replaces the macOS Homebrew PATH hack removed from server/src/index.ts
# Single RUN combines update + install + cache cleanup so the layer stays small
RUN apt-get update && \
    apt-get install -y --no-install-recommends qpdf && \
    rm -rf /var/lib/apt/lists/*

# Production deps: root (currently zero prod deps; included for future-proofing)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Production deps: server only (client deps stay in builder stage; we only need client/dist output)
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --omit=dev --prefix server

# Compiled output from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Forms PDFs (static assets — not built, just copied)
COPY forms/ ./forms/

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
