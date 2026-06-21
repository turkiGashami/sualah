-- Optimistic-concurrency revision for game_sessions. Every state write is
-- guarded by the revision it read and bumps it; concurrent writers (multiple
-- ghouls picking, many players voting at once) retry on conflict instead of
-- silently clobbering each other's action.
alter table game_sessions add column rev int not null default 0;
