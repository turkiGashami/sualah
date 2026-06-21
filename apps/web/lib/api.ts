import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    public code: string,
    detail?: string,
  ) {
    super(detail ?? code);
  }
}

async function invoke<T = unknown>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // FunctionsHttpError carries the original Response in `.context`.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = (await ctx.json()) as { error?: string; detail?: string };
        if (j?.error) throw new ApiError(j.error, j.detail);
      } catch (e) {
        if (e instanceof ApiError) throw e;
      }
    }
    throw new ApiError("request_failed", error.message);
  }
  if (data && (data as { error?: string }).error) throw new ApiError((data as { error: string }).error);
  return data as T;
}

export const api = {
  createRoom: () => invoke<{ roomId: string; code: string }>("rooms", { action: "create" }),
  joinRoom: (code: string, nickname: string) =>
    invoke<{ playerId?: string; roomId: string; seat?: number; spectator: boolean }>("rooms", {
      action: "join",
      code,
      nickname,
    }),
  updateSettings: (roomId: string, settings: Record<string, number>) =>
    invoke<{ ok: true; settings: Record<string, number> }>("rooms", { action: "update_settings", roomId, settings }),
  kick: (roomId: string, playerId: string) => invoke("rooms", { action: "kick", roomId, playerId }),
  start: (roomId: string) => invoke<{ sessionId: string }>("rooms", { action: "start", roomId }),

  monsterPick: (sessionId: string, target: string | null) =>
    invoke("game-action", { type: "monster_pick", sessionId, target }),
  seerInspect: (sessionId: string, target: string) =>
    invoke<{ secret: unknown }>("game-action", { type: "seer_inspect", sessionId, target }),
  guardProtect: (sessionId: string, target: string) =>
    invoke("game-action", { type: "guard_protect", sessionId, target }),
  castVote: (sessionId: string, target: string) => invoke("game-action", { type: "cast_vote", sessionId, target }),
  setConnected: (sessionId: string, connected: boolean) =>
    invoke("game-action", { type: "set_connected", sessionId, connected }),
  hostRemove: (sessionId: string, target: string) => invoke("game-action", { type: "host_remove", sessionId, target }),
  ghostView: (sessionId: string) =>
    invoke<{ ghost: { players: { id: string; role: string; alive: boolean }[]; log: unknown[] } }>("game-action", {
      type: "ghost_view",
      sessionId,
    }),
  reaction: (sessionId: string, emoji: string) => invoke("game-action", { type: "reaction", sessionId, emoji }),
  advance: (sessionId: string) => invoke<{ advanced: boolean; phase?: string }>("advance-phase", { sessionId }),
};
