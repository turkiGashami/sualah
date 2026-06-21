import { describe, expect, it } from "vitest";
import { checkEnd, reduce, onPhaseTimeout } from "../module.js";
import { byId, stateWith } from "./helpers.js";

describe("checkEnd (§7 win conditions)", () => {
  it("village wins when no monsters remain", () => {
    const s = stateWith({ p1: "ghoul", p2: "villager", p3: "seer" });
    byId(s, "p1").alive = false;
    expect(checkEnd(s)).toEqual({ ended: true, winner: "village" });
  });

  it("monsters win when they reach parity with the village", () => {
    const s = stateWith({ p1: "ghoul", p2: "villager" }); // 1 vs 1
    expect(checkEnd(s)).toEqual({ ended: true, winner: "monsters" });
  });

  it("game continues while monsters are outnumbered and present", () => {
    const s = stateWith({ p1: "ghoul", p2: "villager", p3: "villager", p4: "seer" });
    expect(checkEnd(s)).toEqual({ ended: false, winner: null });
  });
});

describe("end-to-end terminal transitions", () => {
  it("executing the last ghoul ends the game for the village and reveals all roles", () => {
    let s = stateWith(
      { p1: "ghoul", p2: "seer", p3: "guard", p4: "villager", p5: "villager", p6: "villager" },
      "vote",
    );
    s = reduce(s, { type: "cast_vote", playerId: "p2", target: "p1" });
    s = reduce(s, { type: "cast_vote", playerId: "p3", target: "p1" });
    s = reduce(s, { type: "cast_vote", playerId: "p4", target: "p1" });
    s = onPhaseTimeout(s); // → execution
    expect(s.phase).toBe("execution");
    s = onPhaseTimeout(s); // → win_check folded in → ended
    expect(s.phase).toBe("ended");
    expect(s.winner).toBe("village");
    expect(s.players.every((p) => p.roleRevealed)).toBe(true);
  });
});

describe("host removal (§7)", () => {
  it("is treated as a death with the role hidden, and re-evaluates the win immediately", () => {
    let s = stateWith({ p1: "ghoul", p2: "villager", p3: "villager" }, "discussion");
    s = reduce(s, { type: "host_remove", playerId: "p2" }); // 1 ghoul vs 1 villager
    expect(s.phase).toBe("ended");
    expect(s.winner).toBe("monsters");
    // the host-removed villager's role is only revealed because the game ended
    expect(byId(s, "p2").eliminatedBy).toBe("host");
  });

  it("is idempotent on an already-removed player", () => {
    let s = stateWith(
      { p1: "ghoul", p2: "seer", p3: "guard", p4: "villager", p5: "villager", p6: "villager" },
      "discussion",
    );
    s = reduce(s, { type: "host_remove", playerId: "p6" });
    const again = reduce(s, { type: "host_remove", playerId: "p6" });
    expect(again.players).toEqual(s.players);
  });
});
