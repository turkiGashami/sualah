# Sealah — Context for Claude Code

## Project Overview
Arabic web party game: hidden-roles social deduction themed on Arabian
folklore (ghouls among villagers). TV screen (/tv/{code}) is the stage with
ambient audio; phones (/play/{code}) hold each player's SECRET role, night
abilities, and votes. Guests join via QR. One of four sibling standalone
game experiments sharing stack/conventions.

## Tech Stack
Next.js 14 (TS strict), Tailwind (RTL), Zustand, Supabase (Postgres +
Anonymous/Email Auth + Realtime + Edge Functions/Deno), packages/game-core
(pure TS), Vitest + Playwright.

## Architecture Rules
- Server-authoritative: clients never write state; Edge Functions only.
- THREE-LAYER STATE — invariant #1 of this repo:
  state (server-only: roles, night targets, seer results),
  public_state (broadcast: alive/dead/phase only),
  player_secrets (RLS: owner only). A secret reaching any other client,
  broadcast, or readable view is a critical bug; stop and fix before
  anything else.
- secret_changed notifications carry NO content and NO player identity;
  phones re-fetch their own secret via RLS on every phase change.
- Ghost reactions: broadcast with random 2–5s delay, no sender identity.
- game-core pure TS; randomness via injected seed (reproducible tests).
- Broadcasts are full public snapshots; timers via phase_deadline_at,
  advance-phase idempotent (+2s grace).

## Code Conventions
- camelCase TS, snake_case DB. Zod at every boundary.
- Edge Functions: try/catch + structured logs + explicit errors.
- Arabic strings in one file per surface.

## CRITICAL — Do NOT
- Do NOT put roles/targets/seer-results in public_state, broadcasts,
  logs, or any client-readable view. Ever.
- Do NOT let clients select game_sessions or votes directly.
- Do NOT reveal a night victim's role at dawn (only at execution/ended).
- Do NOT make day votes visible while voting is open.
- Do NOT use client clocks; do NOT use localStorage except rejoin.

## How to Run
- Web: `pnpm dev` | Functions: `supabase functions serve`
- Unit: `pnpm test` | E2E: `pnpm e2e` | Pen-test: `pnpm pentest`

## Repo Layout
- `packages/game-core` — pure TS state machine (`sealahModule`) + tests.
  Build & test this FIRST; no I/O, seed-injected RNG.
- `apps/web` — Next.js: `app/host`, `app/tv/[code]`, `app/play/[code]`, `lib/`.
- `supabase/migrations` — schema + RLS + `session_public` view.
- `supabase/functions` — `rooms`, `game-action`, `advance-phase` (sole writers).
- `supabase/tests/pentest.ts` — mandatory secret-leak probe (runs in CI).
- `e2e` — Playwright 6-player full session.
