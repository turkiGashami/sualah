import { describe, expect, it } from "vitest";
import { reduce, onPhaseTimeout, isPhaseComplete, type GameAction } from "../module.js";
import type { SualahState } from "../types.js";
import { byId, stateWith } from "./helpers.js";

function apply(s: SualahState, actions: GameAction[]): SualahState {
  return actions.reduce((acc, a) => reduce(acc, a), s);
}

const SIX = {
  p1: "ghoul",
  p2: "ghoul",
  p3: "seer",
  p4: "guard",
  p5: "villager",
  p6: "villager",
} as const;

describe("night — monster victim selection (§7)", () => {
  it("consensus: both monsters on one target kills it", () => {
    let s = stateWith(SIX);
    s = apply(s, [
      { type: "monster_pick", playerId: "p1", target: "p5" },
      { type: "monster_pick", playerId: "p2", target: "p5" },
    ]);
    s = onPhaseTimeout(s);
    expect(s.phase).toBe("dawn");
    expect(s.lastNight?.victimId).toBe("p5");
    expect(byId(s, "p5").alive).toBe(false);
    expect(byId(s, "p5").roleRevealed).toBe(false); // victim role stays hidden
  });

  it("disagreement: the most-picked target dies", () => {
    let s = stateWith({
      p1: "ghoul",
      p2: "ghoul",
      p3: "ghoul",
      p4: "seer",
      p5: "villager",
      p6: "villager",
      p7: "villager",
    });
    s = apply(s, [
      { type: "monster_pick", playerId: "p1", target: "p5" },
      { type: "monster_pick", playerId: "p2", target: "p5" },
      { type: "monster_pick", playerId: "p3", target: "p6" },
    ]);
    s = onPhaseTimeout(s);
    expect(s.lastNight?.victimId).toBe("p5");
  });

  it("tie between targets is broken by the seed, reproducibly", () => {
    const build = () => {
      let s = stateWith(SIX);
      s = apply(s, [
        { type: "monster_pick", playerId: "p1", target: "p5" },
        { type: "monster_pick", playerId: "p2", target: "p6" },
      ]);
      return onPhaseTimeout(s);
    };
    const a = build();
    const b = build();
    expect(a.lastNight?.victimId).toBe(b.lastNight?.victimId);
    expect(["p5", "p6"]).toContain(a.lastNight?.victimId);
    expect(a.rngCursor).toBeGreaterThan(0); // tie-break consumed randomness
  });

  it("all monsters silent → no victim", () => {
    const s = onPhaseTimeout(stateWith(SIX));
    expect(s.lastNight?.victimId).toBeNull();
    expect(s.players.every((p) => p.alive)).toBe(true);
  });

  it("a monster's pick is changeable until the deadline (last wins)", () => {
    let s = stateWith({ p1: "ghoul", p2: "seer", p3: "guard", p4: "villager", p5: "villager" });
    s = apply(s, [
      { type: "monster_pick", playerId: "p1", target: "p4" },
      { type: "monster_pick", playerId: "p1", target: "p5" },
    ]);
    s = onPhaseTimeout(s);
    expect(s.lastNight?.victimId).toBe("p5");
  });

  it("a disconnected monster who didn't pick does not block the night", () => {
    let s = stateWith(SIX);
    s = reduce(s, { type: "set_connected", playerId: "p2", connected: false });
    s = reduce(s, { type: "monster_pick", playerId: "p1", target: "p5" });
    // seer + guard act so the night is otherwise complete
    s = reduce(s, { type: "seer_inspect", playerId: "p3", target: "p1" });
    s = reduce(s, { type: "guard_protect", playerId: "p4", target: "p6" });
    expect(isPhaseComplete(s)).toBe(true);
    s = onPhaseTimeout(s);
    expect(s.lastNight?.victimId).toBe("p5");
  });
});

describe("night — guard (§7)", () => {
  it("protecting the victim saves them (no death)", () => {
    let s = stateWith(SIX);
    s = apply(s, [
      { type: "monster_pick", playerId: "p1", target: "p5" },
      { type: "guard_protect", playerId: "p4", target: "p5" },
    ]);
    s = onPhaseTimeout(s);
    expect(s.lastNight?.victimId).toBeNull();
    expect(s.lastNight?.protectedId).toBe("p5");
    expect(byId(s, "p5").alive).toBe(true);
  });

  it("protecting someone else does not save the victim", () => {
    let s = stateWith(SIX);
    s = apply(s, [
      { type: "monster_pick", playerId: "p1", target: "p5" },
      { type: "guard_protect", playerId: "p4", target: "p6" },
    ]);
    s = onPhaseTimeout(s);
    expect(s.lastNight?.victimId).toBe("p5");
  });

  it("cannot guard the same target two nights running", () => {
    const s = stateWith(SIX, "night", { guardLastTarget: "p5" });
    expect(() => reduce(s, { type: "guard_protect", playerId: "p4", target: "p5" })).toThrow(
      "guard_repeat",
    );
    expect(() => reduce(s, { type: "guard_protect", playerId: "p4", target: "p6" })).not.toThrow();
  });

  it("records the guarded target to block a repeat next night", () => {
    let s = stateWith(SIX);
    s = reduce(s, { type: "guard_protect", playerId: "p4", target: "p6" });
    s = onPhaseTimeout(s);
    expect(s.guardLastTarget).toBe("p6");
  });
});

describe("night — seer (§7)", () => {
  it("reveals the truth immediately, stored in the seer's results", () => {
    let s = stateWith(SIX);
    s = reduce(s, { type: "seer_inspect", playerId: "p3", target: "p1" });
    expect(s.seerResults["p3"]).toEqual([{ round: 1, target: "p1", isMonster: true }]);
    s = reduce(s, { type: "seer_inspect", playerId: "p3", target: "p5" });
    // changing the target this round replaces the tentative result
    expect(s.seerResults["p3"]).toEqual([{ round: 1, target: "p5", isMonster: false }]);
  });

  it("inspection sees through guard protection (protection guards killing only)", () => {
    let s = stateWith(SIX);
    s = apply(s, [
      { type: "guard_protect", playerId: "p4", target: "p1" },
      { type: "seer_inspect", playerId: "p3", target: "p1" },
    ]);
    expect(s.seerResults["p3"]?.[0]?.isMonster).toBe(true);
  });
});

describe("night — completeness", () => {
  it("is incomplete until monsters, seer and guard have all acted", () => {
    let s = stateWith(SIX);
    expect(isPhaseComplete(s)).toBe(false);
    s = reduce(s, { type: "monster_pick", playerId: "p1", target: "p5" });
    expect(isPhaseComplete(s)).toBe(false);
    s = reduce(s, { type: "monster_pick", playerId: "p2", target: "p5" });
    s = reduce(s, { type: "seer_inspect", playerId: "p3", target: "p5" });
    expect(isPhaseComplete(s)).toBe(false);
    s = reduce(s, { type: "guard_protect", playerId: "p4", target: "p6" });
    expect(isPhaseComplete(s)).toBe(true);
  });

  it("rejects abilities used by the wrong role or out of phase", () => {
    const s = stateWith(SIX);
    expect(() => reduce(s, { type: "seer_inspect", playerId: "p5", target: "p1" })).toThrow(
      "not_a_seer",
    );
    expect(() => reduce(s, { type: "monster_pick", playerId: "p3", target: "p1" })).toThrow(
      "not_a_monster",
    );
    const day = stateWith(SIX, "discussion");
    expect(() => reduce(day, { type: "monster_pick", playerId: "p1", target: "p5" })).toThrow(
      "wrong_phase",
    );
  });
});
