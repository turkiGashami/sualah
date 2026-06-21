// Zod schemas at every boundary (§ code conventions). Targets stay loose
// strings here; game-core does the semantic validation (alive? right phase?).
import { z } from "npm:zod@3";

export const nickname = z.string().trim().min(2).max(16);

export const roomsBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("join"), code: z.string().length(4), nickname }),
  z.object({
    action: z.literal("update_settings"),
    roomId: z.string().uuid(),
    settings: z.record(z.number().int().positive()),
  }),
  z.object({ action: z.literal("kick"), roomId: z.string().uuid(), playerId: z.string().uuid() }),
  z.object({ action: z.literal("start"), roomId: z.string().uuid() }),
]);

export const gameActionBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("monster_pick"), sessionId: z.string().uuid(), target: z.string().nullable() }),
  z.object({ type: z.literal("seer_inspect"), sessionId: z.string().uuid(), target: z.string() }),
  z.object({ type: z.literal("guard_protect"), sessionId: z.string().uuid(), target: z.string() }),
  z.object({ type: z.literal("cast_vote"), sessionId: z.string().uuid(), target: z.string() }),
  z.object({ type: z.literal("set_connected"), sessionId: z.string().uuid(), connected: z.boolean() }),
  z.object({ type: z.literal("host_remove"), sessionId: z.string().uuid(), target: z.string().uuid() }),
  z.object({ type: z.literal("ghost_view"), sessionId: z.string().uuid() }),
  z.object({ type: z.literal("reaction"), sessionId: z.string().uuid(), emoji: z.enum(["😱", "🔥", "😂", "👀"]) }),
]);

export const advanceBody = z.object({ sessionId: z.string().uuid() });
