import { create } from "zustand";
import type { PublicState, PlayerSecret } from "@sealah/game-core";

export interface GhostView {
  players: { id: string; role: string; alive: boolean }[];
  log: unknown[];
}

interface RoomStore {
  code: string | null;
  roomId: string | null;
  sessionId: string | null;
  playerId: string | null;
  pub: PublicState | null;
  deadlineAt: string | null;
  secret: PlayerSecret | null;
  ghost: GhostView | null;
  set: (patch: Partial<RoomStore>) => void;
  reset: () => void;
}

const initial = {
  code: null,
  roomId: null,
  sessionId: null,
  playerId: null,
  pub: null,
  deadlineAt: null,
  secret: null,
  ghost: null,
};

export const useRoom = create<RoomStore>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set(initial),
}));
