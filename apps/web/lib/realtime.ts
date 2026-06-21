import { supabase } from "./supabase";

export interface RoomHandlers {
  onState?: (payload: unknown) => void;
  onSecretChanged?: () => void;
  onLobby?: (payload: unknown) => void;
  onReaction?: (payload: { emoji: string }) => void;
  onGameStarted?: (payload: { sessionId: string }) => void;
}

/** Subscribe to the public room channel. Returns an unsubscribe fn. */
export function subscribeRoom(code: string, h: RoomHandlers): () => void {
  const ch = supabase.channel(`room:${code}`);
  ch.on("broadcast", { event: "state_update" }, (m) => h.onState?.(m.payload));
  ch.on("broadcast", { event: "secret_changed" }, () => h.onSecretChanged?.());
  ch.on("broadcast", { event: "lobby_update" }, (m) => h.onLobby?.(m.payload));
  ch.on("broadcast", { event: "reaction" }, (m) => h.onReaction?.(m.payload as { emoji: string }));
  ch.on("broadcast", { event: "game_started" }, (m) => h.onGameStarted?.(m.payload as { sessionId: string }));
  ch.subscribe();
  return () => {
    void supabase.removeChannel(ch);
  };
}
