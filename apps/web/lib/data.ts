import { supabase } from "./supabase";
import type { PublicState, PlayerSecret } from "@sealah/game-core";

export interface SessionPublicRow {
  id: string;
  room_id: string;
  phase: string;
  phase_deadline_at: string | null;
  round: number;
  public_state: PublicState;
  settings: Record<string, number>;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  nickname: string;
  seat: number;
  is_host: boolean;
  connected: boolean;
}

export async function fetchRoomByCode(code: string) {
  const { data } = await supabase
    .from("rooms")
    .select("id, code, status, host_id, settings")
    .eq("code", code)
    .neq("status", "ended")
    .maybeSingle();
  return data;
}

export async function fetchSessionByRoom(roomId: string): Promise<SessionPublicRow | null> {
  const { data } = await supabase
    .from("session_public")
    .select("*")
    .eq("room_id", roomId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as SessionPublicRow | null;
}

export async function fetchPlayers(roomId: string): Promise<PlayerRow[]> {
  const { data } = await supabase.from("players_public").select("*").eq("room_id", roomId).order("seat");
  return (data ?? []) as PlayerRow[];
}

export async function fetchMySecret(sessionId: string): Promise<PlayerSecret | null> {
  // RLS guarantees this returns at most the caller's own row.
  const { data } = await supabase.from("player_secrets").select("secret").eq("session_id", sessionId).maybeSingle();
  return (data?.secret as PlayerSecret) ?? null;
}
