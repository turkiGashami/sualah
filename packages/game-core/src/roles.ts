// Role composition and distribution (§7). Pure + seed-driven so every test can
// pin an exact assignment.

import { MAX_PLAYERS, MIN_PLAYERS, type PlayerId, type Role } from "./types.js";
import { rngShuffle, type Rng } from "./rng.js";

export interface RoleComposition {
  ghoul: number;
  seer: number;
  guard: number;
  villager: number;
}

/** Number of ghouls (monsters) by player count (§7). */
export function ghoulCount(n: number): number {
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new Error(`ghoulCount: player count ${n} out of range [${MIN_PLAYERS}, ${MAX_PLAYERS}]`);
  }
  if (n <= 6) return 1;
  if (n <= 9) return 2;
  if (n <= 13) return 3;
  return 4;
}

/**
 * Full role composition for a given player count (§7):
 * - Seer is always present (from 5 players up).
 * - Guard is present from 6 players up (at 5: seer only).
 * - Remaining players are villagers.
 */
export function roleComposition(n: number): RoleComposition {
  const ghoul = ghoulCount(n);
  const seer = 1;
  const guard = n >= 6 ? 1 : 0;
  const villager = n - ghoul - seer - guard;
  if (villager < 0) {
    throw new Error(`roleComposition: negative villagers for n=${n}`);
  }
  return { ghoul, seer, guard, villager };
}

/** Flat list of roles to hand out, in composition order (pre-shuffle). */
export function rolePool(n: number): Role[] {
  const c = roleComposition(n);
  return [
    ...Array<Role>(c.ghoul).fill("ghoul"),
    ...Array<Role>(c.seer).fill("seer"),
    ...Array<Role>(c.guard).fill("guard"),
    ...Array<Role>(c.villager).fill("villager"),
  ];
}

/**
 * Assigns roles to players deterministically from the rng. Both the pool and
 * the player order are shuffled so neither seat order nor pool order leaks.
 */
export function distributeRoles(
  playerIds: readonly PlayerId[],
  rng: Rng,
): { roles: Record<PlayerId, Role>; rng: Rng } {
  const n = playerIds.length;
  const pool = rolePool(n);

  const shuffledPool = rngShuffle(rng, pool);
  const shuffledIds = rngShuffle(shuffledPool.rng, playerIds);

  const roles: Record<PlayerId, Role> = {};
  shuffledIds.value.forEach((id, i) => {
    roles[id] = shuffledPool.value[i]!;
  });

  return { roles, rng: shuffledIds.rng };
}
