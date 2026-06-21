// Test helpers — build fully-controlled states so rule tests don't depend on
// the random role draw.

import {
  DEFAULT_SETTINGS,
  type Phase,
  type PlayerId,
  type PlayerRuntime,
  type Role,
  type SualahState,
  type SeerResult,
} from "../types.js";

export function stateWith(
  roles: Record<PlayerId, Role>,
  phase: Phase = "night",
  overrides: Partial<SualahState> = {},
): SualahState {
  const players: PlayerRuntime[] = Object.entries(roles).map(([id, role]) => ({
    id,
    role,
    alive: true,
    connected: true,
    roleRevealed: false,
  }));
  const seerResults: Record<PlayerId, SeerResult[]> = {};
  for (const p of players) if (p.role === "seer") seerResults[p.id] = [];

  return {
    version: 1,
    seed: "test-seed",
    rngCursor: 0,
    round: 1,
    phase,
    players,
    night: { monsterPicks: {} },
    guardLastTarget: null,
    seerResults,
    votes: {},
    runoffCandidates: null,
    lastNight: null,
    lastVote: null,
    winner: null,
    settings: DEFAULT_SETTINGS,
    log: [],
    ...overrides,
  };
}

export function ids(n: number): PlayerId[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

export function byId(s: SualahState, id: PlayerId): PlayerRuntime {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}
