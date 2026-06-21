import { describe, expect, it } from "vitest";
import { init, reduce, onPhaseTimeout, derivePublicState } from "../module.js";
import { SKIP, TEAM_OF, type PlayerId, type SualahState } from "../types.js";
import { ids } from "./helpers.js";

const aliveIds = (s: SualahState, pred: (role: string) => boolean): PlayerId[] =>
  s.players.filter((p) => p.alive && pred(p.role)).map((p) => p.id).sort();

/**
 * Omniscient auto-player (tests only — it peeks at the full state). Village
 * always lynches the lowest-id living ghoul; monsters always devour the
 * lowest-id living villager; guard covers someone else. Deterministic and
 * guaranteed to terminate with a village win.
 */
function autoPlay(start: SualahState): SualahState {
  let s = start;
  for (let guard = 0; s.phase !== "ended"; guard++) {
    if (guard > 500) throw new Error(`did not terminate (stuck in ${s.phase})`);

    if (s.phase === "night") {
      const villagers = aliveIds(s, (r) => TEAM_OF[r as never] === "village");
      const victim = villagers[0]!;
      for (const m of aliveIds(s, (r) => r === "ghoul")) {
        s = reduce(s, { type: "monster_pick", playerId: m, target: victim });
      }
      const seer = s.players.find((p) => p.alive && p.role === "seer");
      if (seer) {
        const t = s.players.filter((p) => p.alive && p.id !== seer.id).map((p) => p.id).sort()[0];
        if (t) s = reduce(s, { type: "seer_inspect", playerId: seer.id, target: t });
      }
      const grd = s.players.find((p) => p.alive && p.role === "guard");
      if (grd) {
        const gt = villagers.filter((id) => id !== victim && id !== s.guardLastTarget).at(-1);
        if (gt) s = reduce(s, { type: "guard_protect", playerId: grd.id, target: gt });
      }
      s = onPhaseTimeout(s);
    } else if (s.phase === "vote" || s.phase === "runoff") {
      const candidates = s.phase === "runoff" ? (s.runoffCandidates ?? []) : aliveIds(s, () => true);
      const target =
        candidates.find((c) => s.players.find((p) => p.id === c)?.role === "ghoul") ??
        aliveIds(s, (r) => r === "ghoul")[0];
      for (const v of s.players.filter((p) => p.alive)) {
        s = reduce(s, { type: "cast_vote", playerId: v.id, target: target ?? SKIP });
      }
      s = onPhaseTimeout(s);
    } else {
      s = onPhaseTimeout(s); // role_reveal / dawn / discussion / execution
    }
  }
  return s;
}

describe("init reproducibility", () => {
  it("same seed → identical initial state", () => {
    const a = init({ seed: "session-A", playerIds: ids(8) });
    const b = init({ seed: "session-A", playerIds: ids(8) });
    expect(a).toEqual(b);
  });

  it("different seeds → (almost surely) different role assignment", () => {
    const a = init({ seed: "session-A", playerIds: ids(8) });
    const b = init({ seed: "session-Z", playerIds: ids(8) });
    expect(a.players.map((p) => p.role)).not.toEqual(b.players.map((p) => p.role));
  });
});

describe("full session — deterministic and reproducible (§4.3, §13.6)", () => {
  it.each([6, 7, 9, 12, 16])("a %i-player session plays to a clean win and replays identically", (n) => {
    const seed = `flow-${n}`;
    const final1 = autoPlay(init({ seed, playerIds: ids(n) }));
    const final2 = autoPlay(init({ seed, playerIds: ids(n) }));
    expect(final1.phase).toBe("ended");
    expect(final1.winner).not.toBeNull();
    expect(final2).toEqual(final1); // byte-for-byte reproducible
    expect(final1.players.every((p) => p.roleRevealed)).toBe(true);
  });

  it("with this strategy the village always prevails", () => {
    const final = autoPlay(init({ seed: "village-sweep", playerIds: ids(7) }));
    expect(final.winner).toBe("village");
  });
});

describe("dawn never leaks the victim's role (§7)", () => {
  it("the night victim shows dead but role-hidden in the public projection", () => {
    let s = init({ seed: "dawn-leak", playerIds: ids(7) });
    s = onPhaseTimeout(s); // role_reveal → night
    const villager = s.players.find((p) => p.alive && TEAM_OF[p.role] === "village")!;
    for (const m of s.players.filter((p) => p.alive && p.role === "ghoul")) {
      s = reduce(s, { type: "monster_pick", playerId: m.id, target: villager.id });
    }
    s = onPhaseTimeout(s); // night → dawn
    expect(s.phase).toBe("dawn");
    const pub = derivePublicState(s);
    const victim = pub.players.find((p) => p.id === s.lastNight?.victimId);
    expect(victim?.alive).toBe(false);
    expect(victim?.role).toBeUndefined();
  });
});
