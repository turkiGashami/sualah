import { describe, expect, it } from "vitest";
import { derivePublicState, derivePlayerSecret, deriveGhostView } from "../module.js";
import { byId, stateWith } from "./helpers.js";

const SIX = {
  p1: "ghoul",
  p2: "ghoul",
  p3: "seer",
  p4: "guard",
  p5: "villager",
  p6: "villager",
} as const;

describe("derivePublicState — the broadcast layer must leak NO secret (Invariant #1)", () => {
  it("hides every role while unrevealed", () => {
    const pub = derivePublicState(stateWith(SIX, "night"));
    expect(pub.players.every((p) => p.role === undefined)).toBe(true);
  });

  it("serialized public state contains no role names while none are revealed", () => {
    const s = stateWith(SIX, "night");
    s.seerResults["p3"] = [{ round: 1, target: "p1", isMonster: true }];
    const json = JSON.stringify(derivePublicState(s));
    for (const secret of ["ghoul", "seer", "guard", "villager", "isMonster", "mates", "seerResults"]) {
      expect(json, `leaked "${secret}"`).not.toContain(secret);
    }
  });

  it("reveals a role only once roleRevealed is set", () => {
    const s = stateWith(SIX, "execution");
    byId(s, "p1").roleRevealed = true;
    byId(s, "p1").alive = false;
    const pub = derivePublicState(s);
    expect(pub.players.find((p) => p.id === "p1")?.role).toBe("ghoul");
    expect(pub.players.find((p) => p.id === "p2")?.role).toBeUndefined();
  });

  it("a night victim is shown dead at dawn but with role still hidden (§7)", () => {
    const s = stateWith(SIX, "dawn", {
      lastNight: { round: 1, victimId: "p5", protectedId: null },
    });
    byId(s, "p5").alive = false;
    byId(s, "p5").eliminatedBy = "night";
    const pub = derivePublicState(s);
    const victim = pub.players.find((p) => p.id === "p5");
    expect(victim?.alive).toBe(false);
    expect(victim?.role).toBeUndefined();
    expect(pub.lastNight?.victimId).toBe("p5");
  });
});

describe("derivePlayerSecret — owner-only payloads", () => {
  it("a ghoul learns its mates (and only the mates)", () => {
    const secret = derivePlayerSecret(stateWith(SIX), "p1");
    expect(secret).toEqual({ role: "ghoul", mates: ["p2"] });
  });

  it("a seer carries its own inspection history", () => {
    const s = stateWith(SIX);
    s.seerResults["p3"] = [{ round: 1, target: "p1", isMonster: true }];
    expect(derivePlayerSecret(s, "p3")).toEqual({
      role: "seer",
      results: [{ round: 1, target: "p1", isMonster: true }],
    });
  });

  it("guard and villager secrets reveal nothing beyond their role", () => {
    expect(derivePlayerSecret(stateWith(SIX), "p4")).toEqual({ role: "guard" });
    expect(derivePlayerSecret(stateWith(SIX), "p5")).toEqual({ role: "villager" });
  });
});

describe("deriveGhostView — omniscient, never broadcast", () => {
  it("exposes every role for the eliminated-player view", () => {
    const view = deriveGhostView(stateWith(SIX));
    expect(view.players.find((p) => p.id === "p1")?.role).toBe("ghoul");
    expect(view.players).toHaveLength(6);
  });
});
