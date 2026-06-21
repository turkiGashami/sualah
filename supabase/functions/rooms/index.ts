// rooms — room lifecycle & lobby: create / join / update_settings / kick / start.
// Sole writer of rooms, players, and the initial game_session + player_secrets.
import { preflight, json, fail } from "../_shared/http.ts";
import { admin, getUserId } from "../_shared/supabase.ts";
import { broadcast } from "../_shared/broadcast.ts";
import { nextDeadline, log } from "../_shared/engine.ts";
import { sealahModule } from "../_shared/game-core.js";
import { roomsBody } from "../_shared/validate.ts";

// Unambiguous alphabet (no 0/O/1/I/L) for human-typed 4-char codes.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

// deno-lint-ignore no-explicit-any
async function uniqueCode(db: any): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const c = genCode();
    const { data } = await db.from("rooms").select("id").eq("code", c).neq("status", "ended").maybeSingle();
    if (!data) return c;
  }
  throw new Error("could not allocate a unique room code");
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  try {
    const uid = await getUserId(req);
    if (!uid) return fail("unauthorized", 401);

    const parsed = roomsBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("bad_request", 400, parsed.error.message);
    const body = parsed.data;
    const db = admin();

    if (body.action === "create") {
      await db.from("profiles").upsert({ id: uid });
      const code = await uniqueCode(db);
      const ins = await db.from("rooms").insert({ code, host_id: uid, status: "lobby" }).select().single();
      if (ins.error) return fail("create_failed", 400, ins.error.message);
      log({ fn: "rooms", action: "create", roomCode: code });
      return json({ roomId: ins.data.id, code });
    }

    if (body.action === "join") {
      const banned = await db
        .from("banned_words")
        .select("word")
        .eq("word", body.nickname.toLowerCase())
        .maybeSingle();
      if (banned.data) return fail("nickname_banned", 400);

      const room = await db.from("rooms").select("*").eq("code", body.code).neq("status", "ended").maybeSingle();
      if (!room.data) return fail("room_not_found", 404);

      const existing = await db
        .from("players")
        .select("*")
        .eq("room_id", room.data.id)
        .eq("auth_uid", uid)
        .maybeSingle();
      if (existing.data) {
        return json({ playerId: existing.data.id, roomId: room.data.id, seat: existing.data.seat, spectator: false });
      }
      if (room.data.status !== "lobby") {
        // Joined after kickoff → spectator/ghost; plays the next session (§9).
        return json({ roomId: room.data.id, spectator: true });
      }

      const seats = await db.from("players").select("seat").eq("room_id", room.data.id);
      const nextSeat = (seats.data ?? []).reduce((m: number, r: { seat: number }) => Math.max(m, r.seat), 0) + 1;
      const insP = await db
        .from("players")
        .insert({ room_id: room.data.id, nickname: body.nickname, seat: nextSeat, auth_uid: uid })
        .select()
        .single();
      if (insP.error) {
        if (insP.error.code === "23505") return fail("nickname_taken", 409);
        return fail("join_failed", 400, insP.error.message);
      }
      await broadcast(room.data.code, [
        { event: "lobby_update", payload: { joined: { id: insP.data.id, nickname: body.nickname, seat: nextSeat } } },
      ]);
      return json({ playerId: insP.data.id, roomId: room.data.id, seat: nextSeat, spectator: false });
    }

    // The remaining actions require the caller to be the room host.
    const room = await db.from("rooms").select("*").eq("id", body.roomId).single();
    if (room.error || !room.data) return fail("room_not_found", 404);
    if (room.data.host_id !== uid) return fail("forbidden", 403);

    if (body.action === "update_settings") {
      const merged = { ...room.data.settings, ...body.settings };
      await db.from("rooms").update({ settings: merged }).eq("id", body.roomId);
      await broadcast(room.data.code, [{ event: "lobby_update", payload: { settings: merged } }]);
      return json({ ok: true, settings: merged });
    }

    if (body.action === "kick") {
      if (room.data.status !== "lobby") return fail("game_started", 409, "use host_remove during play");
      await db.from("players").delete().eq("id", body.playerId).eq("room_id", body.roomId);
      await broadcast(room.data.code, [{ event: "lobby_update", payload: { kicked: body.playerId } }]);
      return json({ ok: true });
    }

    if (body.action === "start") {
      if (room.data.status !== "lobby") return fail("already_started", 409);
      const players = await db.from("players").select("*").eq("room_id", body.roomId).order("seat");
      const ids = (players.data ?? []).map((p: { id: string }) => p.id);
      if (ids.length < 5) return fail("not_enough_players", 400);
      if (ids.length > 16) return fail("too_many_players", 400);

      const seed = crypto.randomUUID();
      let state;
      try {
        state = sealahModule.init({ seed, playerIds: ids, settings: room.data.settings });
      } catch (e) {
        return fail("init_failed", 400, String(e));
      }
      const deadline = nextDeadline(state, Date.now());
      const sess = await db
        .from("game_sessions")
        .insert({
          room_id: body.roomId,
          phase: state.phase,
          round: state.round,
          state,
          public_state: sealahModule.derivePublicState(state),
          settings: room.data.settings,
          phase_deadline_at: deadline,
        })
        .select()
        .single();
      if (sess.error) return fail("session_failed", 400, sess.error.message);

      const authBy = new Map((players.data ?? []).map((p: { id: string; auth_uid: string }) => [p.id, p.auth_uid]));
      const secretRows = state.players.map((p: { id: string }) => ({
        session_id: sess.data.id,
        player_id: p.id,
        auth_uid: authBy.get(p.id),
        secret: sealahModule.derivePlayerSecret(state, p.id),
      }));
      const secErr = (await db.from("player_secrets").insert(secretRows)).error;
      if (secErr) return fail("secrets_failed", 400, secErr.message);

      await db.from("rooms").update({ status: "active" }).eq("id", body.roomId);
      await broadcast(room.data.code, [
        { event: "game_started", payload: { sessionId: sess.data.id } },
        { event: "state_update", payload: sealahModule.derivePublicState(state) },
        { event: "secret_changed", payload: {} },
      ]);
      log({ fn: "rooms", action: "start", roomCode: room.data.code, sessionId: sess.data.id, players: ids.length });
      return json({ sessionId: sess.data.id });
    }

    return fail("bad_request", 400);
  } catch (e) {
    log({ fn: "rooms", error: String(e) });
    return fail("internal", 500);
  }
});
