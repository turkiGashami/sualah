-- ════════════════════════════════════════════════════════════════════════════
-- Sualah — initial schema, RLS, and public projections.
--
-- Invariant #1 (§4.1): no client may EVER read
--   • game_sessions.state            (roles, night targets, seer results)
--   • another player's player_secrets
--   • votes of an open phase
-- Enforced by: RLS (no client write policies anywhere) + REVOKE on the raw
-- tables + secrets-free views. All writes go through Edge Functions (service
-- role, which bypasses RLS). The pen-test (supabase/tests/pentest.ts) proves it
-- and runs in CI.
-- ════════════════════════════════════════════════════════════════════════════

-- ── profiles (host accounts) ─────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- ── rooms ─────────────────────────────────────────────────────────────────────
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'ended')),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
-- Only one LIVE (non-ended) room may hold a given 4-char code.
create unique index rooms_live_code on rooms (code) where status <> 'ended';

-- ── players ───────────────────────────────────────────────────────────────────
create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  nickname text not null,
  seat int not null,
  auth_uid uuid not null,             -- anonymous auth uid of this player
  is_host boolean not null default false,
  connected boolean not null default true,
  created_at timestamptz not null default now(),
  unique (room_id, nickname),
  unique (room_id, seat),
  unique (room_id, auth_uid)
);
create index players_room on players (room_id);

-- ── game_sessions ──────────────────────────────────────────────────────────────
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  game_type text not null default 'sualah',
  phase text not null check (phase in (
    'role_reveal', 'night', 'dawn', 'discussion', 'vote', 'runoff', 'execution', 'win_check', 'ended'
  )),
  phase_deadline_at timestamptz,
  round int not null default 0,
  state jsonb not null default '{}',          -- SERVER ONLY: roles & every secret
  public_state jsonb not null default '{}',   -- safe to broadcast
  settings jsonb not null default '{}',
  started_at timestamptz default now(),
  ended_at timestamptz
);
create index game_sessions_room on game_sessions (room_id);

-- ── player_secrets (the only readable secret, owner-only) ───────────────────────
create table player_secrets (
  session_id uuid not null references game_sessions (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  auth_uid uuid not null,             -- denormalized for a direct RLS check
  secret jsonb not null,              -- e.g. {"role":"ghoul","mates":[...]}
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id)
);
create index player_secrets_auth on player_secrets (auth_uid);

-- ── votes (server-only; results broadcast only AFTER a phase closes) ────────────
create table votes (
  session_id uuid not null references game_sessions (id) on delete cascade,
  round int not null,
  phase text not null check (phase in ('vote', 'runoff')),
  voter_id uuid not null references players (id) on delete cascade,
  target_id text not null,            -- a player id (uuid as text) or 'skip'
  created_at timestamptz not null default now(),
  primary key (session_id, round, phase, voter_id)
);

-- ── banned_words (nickname filter; consulted server-side only) ──────────────────
create table banned_words (word text primary key);

-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
alter table profiles       enable row level security;
alter table rooms          enable row level security;
alter table players        enable row level security;
alter table game_sessions  enable row level security;
alter table player_secrets enable row level security;
alter table votes          enable row level security;
alter table banned_words   enable row level security;

-- profiles: a user sees and manages only their own row.
create policy profiles_self_select on profiles
  for select using ((select auth.uid()) = id);
create policy profiles_self_insert on profiles
  for insert with check ((select auth.uid()) = id);
create policy profiles_self_update on profiles
  for update using ((select auth.uid()) = id);

-- rooms: readable (to resolve a scanned code → room) while not ended.
create policy rooms_public_select on rooms
  for select using (status <> 'ended');

-- player_secrets: the SINGLE select policy in the whole schema for game data —
-- and it returns ONLY the caller's own row.
create policy player_secrets_owner on player_secrets
  for select using ((select auth.uid()) = auth_uid);

-- IMPORTANT: there are deliberately NO insert/update/delete policies on any
-- table. Clients therefore cannot write anything; Edge Functions (service role)
-- are the sole writers. game_sessions, players, votes, banned_words have NO
-- select policy either → no client can read their rows directly.

-- ════════════════════════════════════════════════════════════════════════════
-- Defense in depth: strip the raw table privileges from client roles too, so a
-- mistake (e.g. a future policy) can't accidentally expose secrets.
-- ════════════════════════════════════════════════════════════════════════════
revoke all on game_sessions  from anon, authenticated;
revoke all on votes          from anon, authenticated;
revoke all on players        from anon, authenticated;
revoke all on banned_words   from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Public, secrets-free projections (the layer clients ARE allowed to read).
-- These run as the view owner (security definer) so they bypass the base-table
-- REVOKE while exposing ONLY non-secret columns. game_sessions.state is never
-- projected here.
-- ════════════════════════════════════════════════════════════════════════════
create view session_public with (security_invoker = false) as
  select id, room_id, game_type, phase, phase_deadline_at, round,
         public_state, settings, started_at, ended_at
  from game_sessions;

create view players_public with (security_invoker = false) as
  select id, room_id, nickname, seat, is_host, connected, created_at
  from players;   -- note: auth_uid is intentionally NOT exposed

grant select on session_public to anon, authenticated;
grant select on players_public to anon, authenticated;

-- NOTE: game_sessions is intentionally NOT added to the supabase_realtime
-- publication — Postgres CDC would ship the full row (including state). All
-- realtime updates are sent as explicit public-snapshot BROADCASTS from the
-- Edge Functions instead (§6).
