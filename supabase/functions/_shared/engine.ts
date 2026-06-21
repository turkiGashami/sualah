// Shared persistence + broadcast for the writer functions. The game RULES live
// only in game-core (imported via the generated bundle); this file just moves
// the resulting state into Postgres and onto the realtime channel.
import { sealahModule } from "./game-core.js";
import { broadcast } from "./broadcast.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type State = any;

export function log(o: Record<string, unknown>): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));
}

export function nextDeadline(state: State, nowMs: number): string | null {
  const dur = sealahModule.phaseDurationMs(state);
  return dur != null ? new Date(nowMs + dur).toISOString() : null;
}

export interface RoomRow {
  id: string;
  code: string;
}

/** Re-derive and upsert every player's owner-only secret. */
export async function refreshSecrets(
  db: SupabaseClient,
  roomId: string,
  sessionId: string,
  state: State,
): Promise<void> {
  const { data: players } = await db.from("players").select("id, auth_uid").eq("room_id", roomId);
  const authBy = new Map((players ?? []).map((r: { id: string; auth_uid: string }) => [r.id, r.auth_uid]));
  const rows = state.players
    .filter((p: { id: string }) => authBy.has(p.id))
    .map((p: { id: string }) => ({
      session_id: sessionId,
      player_id: p.id,
      auth_uid: authBy.get(p.id),
      secret: sealahModule.derivePlayerSecret(state, p.id),
      updated_at: new Date().toISOString(),
    }));
  if (rows.length) await db.from("player_secrets").upsert(rows);
}

/**
 * Write the new state guarded by the revision it was derived from (bumping rev),
 * refresh secrets, end the room when finished, and broadcast the PUBLIC snapshot
 * + a contentless secret_changed. Returns false when the guard loses the race
 * (another caller already wrote) — the winner's own checks handle advancing.
 */
export async function persistAndBroadcast(
  db: SupabaseClient,
  room: RoomRow,
  sessionId: string,
  state: State,
  deadline: string | null,
  guardRev: number,
): Promise<boolean> {
  const ended = state.phase === "ended";
  const update: Record<string, unknown> = {
    state,
    public_state: sealahModule.derivePublicState(state),
    phase: state.phase,
    round: state.round,
    phase_deadline_at: deadline,
    ended_at: ended ? new Date().toISOString() : null,
    rev: guardRev + 1,
  };
  const { data, error } = await db
    .from("game_sessions")
    .update(update)
    .eq("id", sessionId)
    .eq("rev", guardRev)
    .select("id");
  if (error) throw error;
  if ((data?.length ?? 0) === 0) return false; // race lost

  await refreshSecrets(db, room.id, sessionId, state);
  if (ended) {
    await db.from("rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", room.id);
  }
  await broadcast(room.code, [
    { event: "state_update", payload: sealahModule.derivePublicState(state) },
    { event: "secret_changed", payload: {} }, // no content, no identity (§6)
  ]);
  return true;
}
