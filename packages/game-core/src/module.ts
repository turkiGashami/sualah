// The Sualah state machine. Pure: no I/O, no Date, no Math.random. Time and
// randomness enter only as arguments / via the seed in state. This is the sole
// source of truth for game rules — Edge Functions call into it and persist the
// result; they never re-implement rules.

import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SKIP,
  TEAM_OF,
  type GameEvent,
  type NightActions,
  type Phase,
  type PlayerId,
  type PlayerRuntime,
  type PublicPlayer,
  type PublicState,
  type Role,
  type SualahState,
  type SeerResult,
  type Settings,
  type Team,
  type VoteTarget,
} from "./types.js";
import { distributeRoles } from "./roles.js";
import { rngPick, type Rng } from "./rng.js";

// ── Errors ──────────────────────────────────────────────────────────────────

export class GameError extends Error {
  readonly code: string;
  constructor(code: string, detail?: string) {
    // Message always leads with the stable code, so callers/logs/tests can key
    // off it; the optional detail follows for humans.
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.name = "GameError";
  }
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface InitInput {
  seed: string;
  playerIds: PlayerId[];
  settings?: Partial<Settings>;
}

export type GameAction =
  | { type: "monster_pick"; playerId: PlayerId; target: PlayerId | null }
  | { type: "seer_inspect"; playerId: PlayerId; target: PlayerId }
  | { type: "guard_protect"; playerId: PlayerId; target: PlayerId }
  | { type: "cast_vote"; playerId: PlayerId; target: VoteTarget }
  | { type: "set_connected"; playerId: PlayerId; connected: boolean }
  | { type: "host_remove"; playerId: PlayerId };

/** Secret view written to player_secrets.secret for a single player. */
export type PlayerSecret =
  | { role: "ghoul"; mates: PlayerId[] }
  | { role: "seer"; results: SeerResult[] }
  | { role: "guard" }
  | { role: "villager" };

// ── Internal helpers ─────────────────────────────────────────────────────────

function clone(state: SualahState): SualahState {
  return structuredClone(state);
}

function getPlayer(s: SualahState, id: PlayerId): PlayerRuntime {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new GameError("unknown_player", `no player ${id}`);
  return p;
}

function maybePlayer(s: SualahState, id: PlayerId): PlayerRuntime | undefined {
  return s.players.find((x) => x.id === id);
}

function isAlive(s: SualahState, id: PlayerId): boolean {
  return maybePlayer(s, id)?.alive === true;
}

function isMonster(role: Role): boolean {
  return TEAM_OF[role] === "monsters";
}

function aliveMonsterIds(s: SualahState): PlayerId[] {
  return s.players.filter((p) => p.alive && isMonster(p.role)).map((p) => p.id);
}

function singleAliveOfRole(s: SualahState, role: Role): PlayerRuntime | undefined {
  return s.players.find((p) => p.alive && p.role === role);
}

function rngOf(s: SualahState): Rng {
  return { seed: s.seed, cursor: s.rngCursor };
}

function freshNight(): NightActions {
  return { monsterPicks: {} };
}

// ── init ─────────────────────────────────────────────────────────────────────

export function init(input: InitInput): SualahState {
  const n = input.playerIds.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new GameError("bad_player_count", `need ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${n}`);
  }
  if (new Set(input.playerIds).size !== n) {
    throw new GameError("duplicate_players", "player ids must be unique");
  }

  const { roles, rng } = distributeRoles(input.playerIds, { seed: input.seed, cursor: 0 });

  const players: PlayerRuntime[] = input.playerIds.map((id) => ({
    id,
    role: roles[id]!,
    alive: true,
    connected: true,
    roleRevealed: false,
  }));

  const seerResults: Record<PlayerId, SeerResult[]> = {};
  for (const p of players) if (p.role === "seer") seerResults[p.id] = [];

  return {
    version: 1,
    seed: input.seed,
    rngCursor: rng.cursor,
    round: 0,
    phase: "role_reveal",
    players,
    night: freshNight(),
    guardLastTarget: null,
    seerResults,
    votes: {},
    runoffCandidates: null,
    lastNight: null,
    lastVote: null,
    winner: null,
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
    log: [],
  };
}

// ── reduce: in-phase player actions (do NOT advance the phase) ────────────────

export function reduce(state: SualahState, action: GameAction): SualahState {
  const s = clone(state);

  switch (action.type) {
    case "set_connected": {
      const p = getPlayer(s, action.playerId);
      p.connected = action.connected;
      return s;
    }

    case "host_remove": {
      const p = getPlayer(s, action.playerId);
      if (!p.alive) return s; // idempotent: already gone
      p.alive = false;
      p.eliminatedBy = "host";
      p.eliminatedRound = s.round;
      p.roleRevealed = false; // host-removed players stay hidden until game end (§7)
      delete s.night.monsterPicks[p.id];
      delete s.votes[p.id];
      s.log.push({ type: "host_remove", round: s.round, targetId: p.id });
      // win_check re-evaluated immediately (§7)
      const end = checkEnd(s);
      if (end.ended) return endGame(s, end.winner!);
      return s;
    }

    case "monster_pick": {
      requirePhase(s, "night");
      const p = getPlayer(s, action.playerId);
      if (!p.alive) throw new GameError("not_alive");
      if (p.role !== "ghoul") throw new GameError("not_a_monster");
      if (action.target !== null && !isAlive(s, action.target)) {
        throw new GameError("bad_target", "target must be alive");
      }
      s.night.monsterPicks[p.id] = action.target;
      return s;
    }

    case "seer_inspect": {
      requirePhase(s, "night");
      const p = getPlayer(s, action.playerId);
      if (!p.alive) throw new GameError("not_alive");
      if (p.role !== "seer") throw new GameError("not_a_seer");
      if (!isAlive(s, action.target)) throw new GameError("bad_target", "target must be alive");
      const target = getPlayer(s, action.target);
      // Inspection always reveals the truth — protection guards against killing
      // only, never against the seer (§7).
      const result: SeerResult = {
        round: s.round,
        target: target.id,
        isMonster: isMonster(target.role),
      };
      s.night.seer = { seerId: p.id, target: target.id };
      const history = s.seerResults[p.id] ?? (s.seerResults[p.id] = []);
      // Target is changeable until deadline: replace this round's tentative result.
      const existing = history.findIndex((r) => r.round === s.round);
      if (existing >= 0) history[existing] = result;
      else history.push(result);
      return s;
    }

    case "guard_protect": {
      requirePhase(s, "night");
      const p = getPlayer(s, action.playerId);
      if (!p.alive) throw new GameError("not_alive");
      if (p.role !== "guard") throw new GameError("not_a_guard");
      if (!isAlive(s, action.target)) throw new GameError("bad_target", "target must be alive");
      if (action.target === s.guardLastTarget) {
        throw new GameError("guard_repeat", "cannot guard the same target two nights running");
      }
      s.night.guard = { guardId: p.id, target: action.target };
      return s;
    }

    case "cast_vote": {
      if (s.phase !== "vote" && s.phase !== "runoff") {
        throw new GameError("wrong_phase", `cannot vote in phase ${s.phase}`);
      }
      const p = getPlayer(s, action.playerId);
      if (!p.alive) throw new GameError("not_alive");
      if (s.votes[p.id] !== undefined) {
        throw new GameError("already_voted", "day votes are final once cast (§7)");
      }
      if (action.target !== SKIP) {
        if (!isAlive(s, action.target)) throw new GameError("bad_target", "target must be alive");
        if (s.phase === "runoff" && !(s.runoffCandidates ?? []).includes(action.target)) {
          throw new GameError("bad_target", "runoff is restricted to tied candidates");
        }
      }
      s.votes[p.id] = action.target;
      return s;
    }

    default: {
      const _exhaustive: never = action;
      throw new GameError("unknown_action", JSON.stringify(_exhaustive));
    }
  }
}

function requirePhase(s: SualahState, phase: Phase): void {
  if (s.phase !== phase) throw new GameError("wrong_phase", `expected ${phase}, got ${s.phase}`);
}

// ── checkEnd ─────────────────────────────────────────────────────────────────

export function checkEnd(state: SualahState): { ended: boolean; winner: Team | null } {
  let monsters = 0;
  let village = 0;
  for (const p of state.players) {
    if (!p.alive) continue;
    if (isMonster(p.role)) monsters++;
    else village++;
  }
  if (monsters === 0) return { ended: true, winner: "village" };
  if (monsters >= village) return { ended: true, winner: "monsters" };
  return { ended: false, winner: null };
}

// ── Phase transitions ────────────────────────────────────────────────────────

/**
 * Advance from the current phase to the next dwell phase. Called by the Edge
 * Function when the timer expires OR when the phase is complete early
 * (isPhaseComplete). win_check is folded in here — the engine never rests in it.
 */
export function onPhaseTimeout(state: SualahState): SualahState {
  const s = clone(state);
  switch (s.phase) {
    case "role_reveal":
      return enterNight(s, 1);
    case "night":
      return resolveNight(s); // → dawn
    case "dawn":
      return endOrElse(s, () => enterDiscussion(s));
    case "discussion":
      return enterVote(s);
    case "vote":
      return resolveDay(s, false);
    case "runoff":
      return resolveDay(s, true);
    case "execution":
      return endOrElse(s, () => enterNight(s, s.round + 1));
    case "win_check": // not a dwell phase, but handle defensively
      return endOrElse(s, () => enterNight(s, s.round + 1));
    case "ended":
      return s; // idempotent
    default: {
      const _exhaustive: never = s.phase;
      throw new GameError("bad_phase", String(_exhaustive));
    }
  }
}

function enterNight(s: SualahState, round: number): SualahState {
  s.round = round;
  s.phase = "night";
  s.night = freshNight();
  s.votes = {};
  s.runoffCandidates = null;
  return s;
}

function enterDiscussion(s: SualahState): SualahState {
  s.phase = "discussion";
  s.votes = {};
  s.runoffCandidates = null;
  return s;
}

function enterVote(s: SualahState): SualahState {
  s.phase = "vote";
  s.votes = {};
  s.runoffCandidates = null;
  return s;
}

function resolveNight(s: SualahState): SualahState {
  // Tally monster picks: only non-null picks at living targets count (§7).
  const counts = new Map<PlayerId, number>();
  for (const mid of aliveMonsterIds(s)) {
    const pick = s.night.monsterPicks[mid];
    if (pick && isAlive(s, pick)) counts.set(pick, (counts.get(pick) ?? 0) + 1);
  }

  let victim: PlayerId | null = null;
  if (counts.size > 0) {
    const max = Math.max(...counts.values());
    const top = [...counts.entries()].filter(([, c]) => c === max).map(([id]) => id);
    if (top.length === 1) {
      victim = top[0]!;
    } else {
      // Tie → seeded random among the tied targets; cursor advance is documented
      // in state so the choice is reproducible.
      const picked = rngPick(rngOf(s), top.sort());
      victim = picked.value;
      s.rngCursor = picked.rng.cursor;
    }
  }

  // Guard: a save happens only when the chosen victim is the protected target.
  let protectedId: PlayerId | null = null;
  const guard = s.night.guard;
  if (guard && isAlive(s, guard.guardId) && isAlive(s, guard.target)) {
    if (victim !== null && victim === guard.target) {
      protectedId = guard.target;
      victim = null;
    }
  }

  if (victim !== null) {
    const v = getPlayer(s, victim);
    v.alive = false;
    v.eliminatedBy = "night";
    v.eliminatedRound = s.round;
    v.roleRevealed = false; // victim's role stays hidden (§7)
  }

  s.lastNight = { round: s.round, victimId: victim, protectedId };
  s.log.push({ type: "night_result", round: s.round, victimId: victim, protectedId });

  // Remember what the guard covered this night, to block a repeat next night.
  s.guardLastTarget = guard ? guard.target : null;

  s.phase = "dawn";
  return s;
}

function resolveDay(s: SualahState, isRunoff: boolean): SualahState {
  const { eliminatedId, tied } = tallyDayVotes(s, isRunoff ? s.runoffCandidates : null);

  if (eliminatedId) {
    const v = getPlayer(s, eliminatedId);
    v.alive = false;
    v.eliminatedBy = "vote";
    v.eliminatedRound = s.round;
    v.roleRevealed = true; // executed player's role IS revealed (§7)
    s.lastVote = { round: s.round, phase: isRunoff ? "runoff" : "vote", eliminatedId, tied: [] };
    s.log.push({
      type: "elimination",
      round: s.round,
      phase: isRunoff ? "runoff" : "vote",
      targetId: eliminatedId,
      tied: [],
    });
    s.phase = "execution";
    s.votes = {};
    s.runoffCandidates = null;
    return s;
  }

  // No outright winner.
  if (!isRunoff && tied.length > 1) {
    // First-round tie → a single runoff between the tied players only (§7).
    s.runoffCandidates = tied;
    s.votes = {};
    s.phase = "runoff";
    s.lastVote = { round: s.round, phase: "vote", eliminatedId: null, tied };
    return s;
  }

  // Second tie or skip wins → no expulsion. Move on.
  s.lastVote = {
    round: s.round,
    phase: isRunoff ? "runoff" : "vote",
    eliminatedId: null,
    tied,
  };
  s.log.push({
    type: "elimination",
    round: s.round,
    phase: isRunoff ? "runoff" : "vote",
    targetId: null,
    tied,
  });
  s.votes = {};
  s.runoffCandidates = null;
  return endOrElse(s, () => enterNight(s, s.round + 1));
}

/**
 * Plurality tally with explicit skip handling (§7):
 * - skip count ≥ top player count → no expulsion (skip wins or ties the lead).
 * - single top player → eliminated.
 * - multiple tied top players → returned in `tied` for the caller to runoff.
 */
function tallyDayVotes(
  s: SualahState,
  restrictTo: PlayerId[] | null,
): { eliminatedId: PlayerId | null; tied: PlayerId[] } {
  const playerCounts = new Map<PlayerId, number>();
  let skipCount = 0;

  for (const [voterId, target] of Object.entries(s.votes)) {
    if (!isAlive(s, voterId)) continue; // disconnected/removed → vote drops (§7)
    if (target === SKIP) {
      skipCount++;
      continue;
    }
    if (!isAlive(s, target)) continue;
    if (restrictTo && !restrictTo.includes(target)) continue;
    playerCounts.set(target, (playerCounts.get(target) ?? 0) + 1);
  }

  const maxPlayer = playerCounts.size > 0 ? Math.max(...playerCounts.values()) : 0;
  if (maxPlayer === 0) return { eliminatedId: null, tied: [] };
  if (skipCount >= maxPlayer) return { eliminatedId: null, tied: [] };

  const top = [...playerCounts.entries()].filter(([, c]) => c === maxPlayer).map(([id]) => id);
  if (top.length === 1) return { eliminatedId: top[0]!, tied: [] };
  return { eliminatedId: null, tied: top.sort() };
}

function endOrElse(s: SualahState, next: () => SualahState): SualahState {
  const end = checkEnd(s);
  if (end.ended) return endGame(s, end.winner!);
  return next();
}

function endGame(s: SualahState, winner: Team): SualahState {
  s.winner = winner;
  s.phase = "ended";
  for (const p of s.players) p.roleRevealed = true; // all roles laid bare (§7)
  s.log.push({ type: "game_end", winner, round: s.round });
  return s;
}

// ── Early-advance completeness ───────────────────────────────────────────────

/**
 * True when every connected, living ability-holder / voter has acted, so the
 * Edge Function can advance before the deadline. Disconnected players never
 * block (their turn is skipped, §7).
 */
export function isPhaseComplete(state: SualahState): boolean {
  const s = state;
  if (s.phase === "night") {
    const monstersReady = s.players
      .filter((p) => p.alive && p.connected && p.role === "ghoul")
      .every((p) => p.id in s.night.monsterPicks);
    const seer = singleAliveOfRole(s, "seer");
    const seerReady = !seer || !seer.connected || s.night.seer?.seerId === seer.id;
    const guard = singleAliveOfRole(s, "guard");
    const guardReady = !guard || !guard.connected || s.night.guard?.guardId === guard.id;
    return monstersReady && seerReady && guardReady;
  }
  if (s.phase === "vote" || s.phase === "runoff") {
    return s.players
      .filter((p) => p.alive && p.connected)
      .every((p) => s.votes[p.id] !== undefined);
  }
  return false; // role_reveal / dawn / discussion / execution run on the timer
}

export function phaseDurationMs(state: SualahState): number | null {
  const x = state.settings;
  switch (state.phase) {
    case "role_reveal":
      return x.roleRevealMs;
    case "night":
      return x.nightMs;
    case "dawn":
      return x.dawnMs;
    case "discussion":
      return x.discussionMs;
    case "vote":
      return x.voteMs;
    case "runoff":
      return x.runoffMs;
    case "execution":
      return x.executionMs;
    case "win_check":
    case "ended":
      return null;
    default: {
      const _exhaustive: never = state.phase;
      throw new GameError("bad_phase", String(_exhaustive));
    }
  }
}

// ── Projections: the three-layer split (§4.1) ────────────────────────────────

/** Safe-to-broadcast public projection. Roles appear only once revealed. */
export function derivePublicState(state: SualahState): PublicState {
  const players: PublicPlayer[] = state.players.map((p) => {
    const pub: PublicPlayer = { id: p.id, alive: p.alive, connected: p.connected };
    if (p.roleRevealed) pub.role = p.role;
    if (p.eliminatedBy) pub.eliminatedBy = p.eliminatedBy;
    if (p.eliminatedRound !== undefined) pub.eliminatedRound = p.eliminatedRound;
    return pub;
  });

  return {
    version: 1,
    round: state.round,
    phase: state.phase,
    players,
    lastNight: state.lastNight,
    lastVote: state.lastVote ? { round: state.lastVote.round, eliminatedId: state.lastVote.eliminatedId } : null,
    runoffCandidates: state.phase === "runoff" ? state.runoffCandidates : null,
    winner: state.winner,
    ended: state.phase === "ended",
  };
}

/** The private secret written to player_secrets for one player (owner-only). */
export function derivePlayerSecret(state: SualahState, playerId: PlayerId): PlayerSecret {
  const p = getPlayer(state, playerId);
  switch (p.role) {
    case "ghoul":
      return {
        role: "ghoul",
        mates: state.players.filter((x) => x.role === "ghoul" && x.id !== p.id).map((x) => x.id),
      };
    case "seer":
      return { role: "seer", results: state.seerResults[p.id] ?? [] };
    case "guard":
      return { role: "guard" };
    case "villager":
      return { role: "villager" };
    default: {
      const _exhaustive: never = p.role;
      throw new GameError("bad_role", String(_exhaustive));
    }
  }
}

/**
 * Omniscient view for ghost mode (eliminated players, §7). Carries every role —
 * delivered ONLY to a verified-dead caller via an Edge Function, never broadcast.
 */
export function deriveGhostView(state: SualahState): {
  players: { id: PlayerId; role: Role; alive: boolean }[];
  log: GameEvent[];
} {
  return {
    players: state.players.map((p) => ({ id: p.id, role: p.role, alive: p.alive })),
    log: state.log,
  };
}
