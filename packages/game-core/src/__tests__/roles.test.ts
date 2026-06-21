import { describe, expect, it } from "vitest";
import { ghoulCount, roleComposition, distributeRoles, rolePool } from "../roles.js";
import { MAX_PLAYERS, MIN_PLAYERS, type Role } from "../types.js";
import { ids } from "./helpers.js";

const EXPECTED: Record<number, { ghoul: number; seer: number; guard: number; villager: number }> = {
  5: { ghoul: 1, seer: 1, guard: 0, villager: 3 },
  6: { ghoul: 1, seer: 1, guard: 1, villager: 3 },
  7: { ghoul: 2, seer: 1, guard: 1, villager: 3 },
  8: { ghoul: 2, seer: 1, guard: 1, villager: 4 },
  9: { ghoul: 2, seer: 1, guard: 1, villager: 5 },
  10: { ghoul: 3, seer: 1, guard: 1, villager: 5 },
  11: { ghoul: 3, seer: 1, guard: 1, villager: 6 },
  12: { ghoul: 3, seer: 1, guard: 1, villager: 7 },
  13: { ghoul: 3, seer: 1, guard: 1, villager: 8 },
  14: { ghoul: 4, seer: 1, guard: 1, villager: 8 },
  15: { ghoul: 4, seer: 1, guard: 1, villager: 9 },
  16: { ghoul: 4, seer: 1, guard: 1, villager: 10 },
};

describe("role composition (§7)", () => {
  it("ghoul counts by player count", () => {
    expect([5, 6].map(ghoulCount)).toEqual([1, 1]);
    expect([7, 8, 9].map(ghoulCount)).toEqual([2, 2, 2]);
    expect([10, 11, 12, 13].map(ghoulCount)).toEqual([3, 3, 3, 3]);
    expect([14, 15, 16].map(ghoulCount)).toEqual([4, 4, 4]);
  });

  it("rejects out-of-range player counts", () => {
    expect(() => ghoulCount(MIN_PLAYERS - 1)).toThrow();
    expect(() => ghoulCount(MAX_PLAYERS + 1)).toThrow();
  });

  it("matches the expected composition for every supported size", () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      expect(roleComposition(n), `n=${n}`).toEqual(EXPECTED[n]);
    }
  });

  it("seer always present; guard only from 6 up", () => {
    expect(roleComposition(5).seer).toBe(1);
    expect(roleComposition(5).guard).toBe(0);
    for (let n = 6; n <= MAX_PLAYERS; n++) expect(roleComposition(n).guard).toBe(1);
  });
});

describe("distributeRoles", () => {
  it("hands out exactly the composition for every size, all players assigned", () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      const players = ids(n);
      const { roles } = distributeRoles(players, { seed: `seed-${n}`, cursor: 0 });
      expect(Object.keys(roles).sort()).toEqual([...players].sort());
      const counts: Record<Role, number> = { ghoul: 0, seer: 0, guard: 0, villager: 0 };
      for (const id of players) counts[roles[id]!]++;
      expect(counts, `n=${n}`).toEqual(EXPECTED[n]);
    }
  });

  it("is deterministic for a given seed and varies across seeds", () => {
    const players = ids(8);
    const a = distributeRoles(players, { seed: "alpha", cursor: 0 }).roles;
    const b = distributeRoles(players, { seed: "alpha", cursor: 0 }).roles;
    const c = distributeRoles(players, { seed: "beta", cursor: 0 }).roles;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c); // overwhelmingly likely; pinned seeds
  });

  it("rolePool length equals player count", () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) expect(rolePool(n)).toHaveLength(n);
  });
});
