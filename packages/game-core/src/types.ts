// Pure domain types for Sualah. No I/O, no Date, no Math.random anywhere in
// game-core — see rng.ts for deterministic, seed-driven randomness.

export type Role = "villager" | "seer" | "guard" | "ghoul";
export type Team = "village" | "monsters";

/** Maps a role to its team. Ghouls are the monsters; everyone else is village. */
export const TEAM_OF: Record<Role, Team> = {
  villager: "village",
  seer: "village",
  guard: "village",
  ghoul: "monsters",
};

/**
 * Dwell phases the engine actually rests in. `win_check` is computed inline
 * during transitions (instantaneous), never dwelt on, but kept in the union so
 * the DB enum and any UI can reference it.
 */
export type Phase =
  | "role_reveal"
  | "night"
  | "dawn"
  | "discussion"
  | "vote"
  | "runoff"
  | "execution"
  | "win_check"
  | "ended";

export type PlayerId = string;

/** Sentinel target for a "skip / no expulsion" vote. */
export const SKIP = "skip";
export type VoteTarget = PlayerId | typeof SKIP;

export interface Settings {
  roleRevealMs: number;
  nightMs: number;
  dawnMs: number;
  discussionMs: number;
  voteMs: number;
  runoffMs: number;
  executionMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  roleRevealMs: 15_000,
  nightMs: 60_000,
  dawnMs: 6_000,
  discussionMs: 180_000, // 3 min default
  voteMs: 45_000,
  runoffMs: 20_000,
  executionMs: 7_000,
};

/** Host-configurable discussion durations (§7): 2 / 3 / 5 minutes. */
export const DISCUSSION_OPTIONS_MS = [120_000, 180_000, 300_000] as const;

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 16;

export type EliminationCause = "night" | "vote" | "host";

export interface PlayerRuntime {
  id: PlayerId;
  role: Role;
  alive: boolean;
  /** Connection state; drives the disconnect-skip rules (§7). */
  connected: boolean;
  eliminatedRound?: number;
  eliminatedBy?: EliminationCause;
  /**
   * Whether this player's role has been publicly revealed. True only after a
   * vote execution or at game end — NEVER at dawn for a night victim (§7).
   */
  roleRevealed: boolean;
}

export interface SeerResult {
  round: number;
  target: PlayerId;
  isMonster: boolean;
}

export interface NightActions {
  /** Each alive monster's latest pick. null = explicit abstain. */
  monsterPicks: Record<PlayerId, PlayerId | null>;
  seer?: { seerId: PlayerId; target: PlayerId };
  guard?: { guardId: PlayerId; target: PlayerId };
}

export type GameEvent =
  | {
      type: "night_result";
      round: number;
      victimId: PlayerId | null;
      protectedId: PlayerId | null;
    }
  | {
      type: "elimination";
      round: number;
      phase: "vote" | "runoff";
      targetId: PlayerId | null;
      tied: PlayerId[];
    }
  | { type: "host_remove"; round: number; targetId: PlayerId }
  | { type: "game_end"; winner: Team; round: number };

/**
 * The FULL authoritative state. Lives in game_sessions.state (server-only).
 * Contains every secret (roles, night targets, seer results) — must NEVER be
 * broadcast or exposed to any client. See derivePublicState() for the safe view.
 */
export interface SualahState {
  version: 1;
  seed: string;
  /** Advances every time randomness is consumed; makes replays identical. */
  rngCursor: number;
  round: number;
  phase: Phase;
  players: PlayerRuntime[];
  night: NightActions;
  /** Guard cannot protect the same target two consecutive nights (§7). */
  guardLastTarget: PlayerId | null;
  /** Per-seer history of inspection results. */
  seerResults: Record<PlayerId, SeerResult[]>;
  /** Active day-vote ballots for the current vote/runoff phase. */
  votes: Record<PlayerId, VoteTarget>;
  /** Candidates a runoff is restricted to (set when entering runoff). */
  runoffCandidates: PlayerId[] | null;
  lastNight: { round: number; victimId: PlayerId | null; protectedId: PlayerId | null } | null;
  lastVote: {
    round: number;
    phase: "vote" | "runoff";
    eliminatedId: PlayerId | null;
    tied: PlayerId[];
  } | null;
  winner: Team | null;
  settings: Settings;
  log: GameEvent[];
}

/**
 * The PUBLIC projection — alive/dead, phase, round, and only roles that have
 * already been revealed. Safe to broadcast and to store in public_state.
 */
export interface PublicState {
  version: 1;
  round: number;
  phase: Phase;
  players: PublicPlayer[];
  /** Dawn announcement: who died last night (role still hidden), or null. */
  lastNight: { round: number; victimId: PlayerId | null; protectedId: PlayerId | null } | null;
  /** Last day-vote outcome (revealed AFTER the phase closes). */
  lastVote: { round: number; eliminatedId: PlayerId | null } | null;
  /** Tied candidates a runoff is restricted to (public, not a secret). */
  runoffCandidates: PlayerId[] | null;
  winner: Team | null;
  /** At ended: every role is laid bare. */
  ended: boolean;
}

export interface PublicPlayer {
  id: PlayerId;
  alive: boolean;
  connected: boolean;
  /** Present ONLY when roleRevealed is true. Hidden otherwise. */
  role?: Role;
  eliminatedBy?: EliminationCause;
  eliminatedRound?: number;
}
