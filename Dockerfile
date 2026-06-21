# syntax=docker/dockerfile:1
# Sualah web — Next.js standalone in a pnpm monorepo. Deterministic build for
# CranL (Build Type: Dockerfile). Backend is on Supabase.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ── build ─────────────────────────────────────────────────────────────────────
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# NEXT_PUBLIC_* are inlined at build time. These are the PUBLIC Supabase keys
# (anon/publishable + URL) — safe to ship in the client bundle.
ENV NEXT_PUBLIC_SUPABASE_URL=https://eiooasvslicpmmhuhdei.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_jjfIvyCWT82KsdzgkQtyTQ_L84zs8bA
RUN pnpm --filter @sualah/web build

# ── runtime (standalone) ──────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
