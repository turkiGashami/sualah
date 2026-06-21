// Deterministic, seed-driven randomness. game-core stays pure: instead of
// Math.random we carry {seed, cursor} and derive each draw from them, advancing
// the cursor so a given (seed, sequence-of-consumption) always replays
// identically — the property §4.3 / §13.3 require for reproducible tests.

export interface Rng {
  seed: string;
  cursor: number;
}

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** mulberry32 — a small, fast PRNG. Pure: same input → same output. */
function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A float in [0, 1) deterministic in (seed, cursor). */
export function draw(seed: string, cursor: number): number {
  const base = (hashSeed(seed) + Math.imul(cursor, 0x9e3779b1)) | 0;
  return mulberry32(base);
}

/** Returns an integer in [0, maxExclusive) and the advanced rng. */
export function rngInt(rng: Rng, maxExclusive: number): { value: number; rng: Rng } {
  if (maxExclusive <= 0) throw new Error("rngInt: maxExclusive must be > 0");
  const value = Math.floor(draw(rng.seed, rng.cursor) * maxExclusive);
  return { value, rng: { seed: rng.seed, cursor: rng.cursor + 1 } };
}

/** Picks one element from a non-empty array. */
export function rngPick<T>(rng: Rng, arr: readonly T[]): { value: T; rng: Rng } {
  if (arr.length === 0) throw new Error("rngPick: empty array");
  const { value: idx, rng: next } = rngInt(rng, arr.length);
  return { value: arr[idx]!, rng: next };
}

/** Fisher–Yates shuffle, returning a new array and the advanced rng. */
export function rngShuffle<T>(rng: Rng, arr: readonly T[]): { value: T[]; rng: Rng } {
  const out = arr.slice();
  let cur: Rng = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const { value: j, rng: next } = rngInt(cur, i + 1);
    cur = next;
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return { value: out, rng: cur };
}
