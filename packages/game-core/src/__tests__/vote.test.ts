import { describe, expect, it } from "vitest";
import { reduce, onPhaseTimeout, isPhaseComplete, type GameAction } from "../module.js";
import type { SealahState } from "../types.js";
import { SKIP } from "../types.js";
import { byId, stateWith } from "./helpers.js";

function apply(s: SealahState, actions: GameAction[]): SealahState {
  return actions.reduce((acc, a) => reduce(acc, a), s);
}

// p1 ghoul; rest village. Two extra villagers keep the village ahead so a vote
// doesn't accidentally end the game during these focused tests.
const SIX = {
  p1: "ghoul",
  p2: "seer",
  p3: "guard",
  p4: "villager",
  p5: "villager",
  p6: "villager",
} as const;

describe("day vote — plurality (§7)", () => {
  it("the plurality target is executed and their role revealed", () => {
    let s = stateWith(SIX, "vote");
    s = apply(s, [
      { type: "cast_vote", playerId: "p2", target: "p1" },
      { type: "cast_vote", playerId: "p3", target: "p1" },
      { type: "cast_vote", playerId: "p4", target: "p1" },
      { type: "cast_vote", playerId: "p5", target: "p6" },
      { type: "cast_vote", playerId: "p6", target: SKIP },
      { type: "cast_vote", playerId: "p1", target: SKIP },
    ]);
    s = onPhaseTimeout(s);
    expect(s.phase).toBe("execution");
    expect(s.lastVote?.eliminatedId).toBe("p1");
    expect(byId(s, "p1").alive).toBe(false);
    expect(byId(s, "p1").roleRevealed).toBe(true); // executed → revealed
  });

  it("skip winning (or tying the lead) means no expulsion", () => {
    let s = stateWith(SIX, "vote");
    s = apply(s, [
      { type: "cast_vote", playerId: "p1", target: SKIP },
      { type: "cast_vote", playerId: "p2", target: SKIP },
      { type: "cast_vote", playerId: "p3", target: SKIP },
      { type: "cast_vote", playerId: "p4", target: SKIP },
      { type: "cast_vote", playerId: "p5", target: "p1" },
      { type: "cast_vote", playerId: "p6", target: "p1" },
    ]);
    s = onPhaseTimeout(s);
    expect(s.lastVote?.eliminatedId).toBeNull();
    expect(s.phase).toBe("night"); // game continues
  });

  it("a disconnected player's missing vote simply drops; plurality is of actual voters", () => {
    let s = stateWith(SIX, "vote");
    s = reduce(s, { type: "set_connected", playerId: "p6", connected: false });
    s = apply(s, [
      { type: "cast_vote", playerId: "p2", target: "p1" },
      { type: "cast_vote", playerId: "p3", target: "p1" },
      { type: "cast_vote", playerId: "p4", target: "p1" },
      { type: "cast_vote", playerId: "p5", target: SKIP },
      { type: "cast_vote", playerId: "p1", target: SKIP },
    ]);
    s = onPhaseTimeout(s); // p1: 3 votes, skip: 2 (p6 never voted)
    expect(s.lastVote?.eliminatedId).toBe("p1");
  });

  it("day votes are final once cast", () => {
    let s = stateWith(SIX, "vote");
    s = reduce(s, { type: "cast_vote", playerId: "p2", target: "p1" });
    expect(() => reduce(s, { type: "cast_vote", playerId: "p2", target: "p4" })).toThrow(
      "already_voted",
    );
  });

  it("cannot vote outside a voting phase", () => {
    const s = stateWith(SIX, "discussion");
    expect(() => reduce(s, { type: "cast_vote", playerId: "p2", target: "p1" })).toThrow(
      "wrong_phase",
    );
  });

  it("vote completeness ignores disconnected players", () => {
    let s = stateWith(SIX, "vote");
    s = reduce(s, { type: "set_connected", playerId: "p6", connected: false });
    s = apply(s, [
      { type: "cast_vote", playerId: "p1", target: SKIP },
      { type: "cast_vote", playerId: "p2", target: "p1" },
      { type: "cast_vote", playerId: "p3", target: "p1" },
      { type: "cast_vote", playerId: "p4", target: SKIP },
      { type: "cast_vote", playerId: "p5", target: SKIP },
    ]);
    expect(isPhaseComplete(s)).toBe(true); // p6 disconnected, not required
  });
});

describe("day vote — ties & runoff (§7)", () => {
  it("a first-round tie among players triggers a single runoff", () => {
    let s = stateWith(SIX, "vote");
    s = apply(s, [
      { type: "cast_vote", playerId: "p3", target: "p1" },
      { type: "cast_vote", playerId: "p4", target: "p1" },
      { type: "cast_vote", playerId: "p5", target: "p2" },
      { type: "cast_vote", playerId: "p6", target: "p2" },
      { type: "cast_vote", playerId: "p1", target: "p3" },
      { type: "cast_vote", playerId: "p2", target: "p4" },
    ]);
    s = onPhaseTimeout(s);
    expect(s.phase).toBe("runoff");
    expect(s.runoffCandidates).toEqual(["p1", "p2"]);
    expect(s.votes).toEqual({}); // ballots reset for the runoff
  });

  it("the runoff resolves to the plurality target", () => {
    const s0 = stateWith(SIX, "runoff", { runoffCandidates: ["p1", "p2"] });
    let s = apply(s0, [
      { type: "cast_vote", playerId: "p3", target: "p1" },
      { type: "cast_vote", playerId: "p4", target: "p1" },
      { type: "cast_vote", playerId: "p5", target: "p1" },
      { type: "cast_vote", playerId: "p1", target: "p2" },
      { type: "cast_vote", playerId: "p2", target: SKIP },
      { type: "cast_vote", playerId: "p6", target: SKIP },
    ]);
    s = onPhaseTimeout(s);
    expect(s.phase).toBe("execution");
    expect(s.lastVote?.eliminatedId).toBe("p1");
  });

  it("a second tie (or skip) in the runoff = no expulsion", () => {
    const s0 = stateWith(SIX, "runoff", { runoffCandidates: ["p1", "p2"] });
    let s = apply(s0, [
      { type: "cast_vote", playerId: "p3", target: "p1" },
      { type: "cast_vote", playerId: "p4", target: "p2" },
      { type: "cast_vote", playerId: "p5", target: SKIP },
      { type: "cast_vote", playerId: "p6", target: SKIP },
    ]);
    s = onPhaseTimeout(s);
    expect(s.lastVote?.eliminatedId).toBeNull();
    expect(s.phase).toBe("night");
  });

  it("runoff ballots are restricted to the tied candidates", () => {
    const s = stateWith(SIX, "runoff", { runoffCandidates: ["p1", "p2"] });
    expect(() => reduce(s, { type: "cast_vote", playerId: "p3", target: "p4" })).toThrow(
      "bad_target",
    );
    expect(() => reduce(s, { type: "cast_vote", playerId: "p3", target: "p1" })).not.toThrow();
    expect(() => reduce(s, { type: "cast_vote", playerId: "p4", target: SKIP })).not.toThrow();
  });
});
