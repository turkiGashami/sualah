// game-action — player abilities, votes, connection, ghost view & reactions,
// host removal. The acting player's identity is ALWAYS derived from the
// verified JWT, never trusted from the body.
import { preflight, json, fail } from "../_shared/http.ts";
import { admin, getUserId } from "../_shared/supabase.ts";
import { broadcast } from "../_shared/broadcast.ts";
import { nextDeadline, persistAndBroadcast, refreshSecrets, log } from "../_shared/engine.ts";
import { sualahModule, GameError } from "../_shared/game-core.js";
import { gameActionBody } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  try {
    const uid = await getUserId(req);
    if (!uid) return fail("unauthorized", 401);

    const parsed = gameActionBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("bad_request", 400, parsed.error.message);
    const body = parsed.data;
    const db = admin();

    const session = await db.from("game_sessions").select("*").eq("id", body.sessionId).single();
    if (session.error || !session.data) return fail("session_not_found", 404);
    const room = await db.from("rooms").select("*").eq("id", session.data.room_id).single();
    if (room.error || !room.data) return fail("room_not_found", 404);

    const me = (await db.from("players").select("*").eq("room_id", room.data.id).eq("auth_uid", uid).maybeSingle())
      .data;
    const state = session.data.state;
    const meRuntime = me ? state.players.find((p: { id: string }) => p.id === me.id) : undefined;

    // ── ghost view: an eliminated player gets the omniscient reveal (§7) ──────
    if (body.type === "ghost_view") {
      if (!me) return fail("not_in_game", 403);
      if (!meRuntime || meRuntime.alive) return fail("not_a_ghost", 403);
      return json({ ghost: sualahModule.deriveGhostView(state) });
    }

    // ── ghost reaction: broadcast with a random 2–5s delay, no identity (§7) ──
    if (body.type === "reaction") {
      if (!me || !meRuntime || meRuntime.alive) return fail("not_a_ghost", 403);
      const delay = 2000 + Math.floor(Math.random() * 3000);
      const task = (async () => {
        await new Promise((r) => setTimeout(r, delay));
        await broadcast(room.data.code, [{ event: "reaction", payload: { emoji: body.emoji } }]);
      })();
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil?.(task);
      return json({ ok: true });
    }

    if (session.data.phase === "ended") return fail("game_over", 409);

    // ── build the action with a SERVER-derived player id ─────────────────────
    let action: Record<string, unknown>;
    if (body.type === "host_remove") {
      if (room.data.host_id !== uid) return fail("forbidden", 403);
      action = { type: "host_remove", playerId: body.target };
    } else {
      if (!me) return fail("not_in_game", 403);
      switch (body.type) {
        case "monster_pick":
        case "seer_inspect":
        case "guard_protect":
        case "cast_vote":
          action = { type: body.type, playerId: me.id, target: body.target };
          break;
        case "set_connected":
          action = { type: "set_connected", playerId: me.id, connected: body.connected };
          break;
      }
    }

    // ── apply the rule under optimistic concurrency ──────────────────────────
    // Re-read state+rev and write guarded by rev so concurrent actors (multiple
    // ghouls, many voters) never clobber each other; retry on conflict.
    let curState = session.data.state;
    let curRev: number = session.data.rev;
    // deno-lint-ignore no-explicit-any
    let newState: any = null;
    let newRev = -1;
    for (let attempt = 0; attempt < 8 && newRev < 0; attempt++) {
      try {
        // deno-lint-ignore no-explicit-any
        newState = sualahModule.reduce(curState, action as any);
      } catch (e) {
        if (e instanceof GameError) return fail(e.code, 400);
        return fail("bad_action", 400, String(e));
      }
      const upd: Record<string, unknown> = {
        state: newState,
        public_state: sualahModule.derivePublicState(newState),
        phase: newState.phase,
        round: newState.round,
        rev: curRev + 1,
      };
      if (newState.phase === "ended") {
        upd.ended_at = new Date().toISOString();
        upd.phase_deadline_at = null;
      }
      const { data } = await db
        .from("game_sessions")
        .update(upd)
        .eq("id", body.sessionId)
        .eq("rev", curRev)
        .select("id");
      if ((data?.length ?? 0) > 0) {
        newRev = curRev + 1;
        break;
      }
      // Lost the race — re-read and re-apply on fresh state.
      const re = await db.from("game_sessions").select("state, rev, phase").eq("id", body.sessionId).single();
      if (!re.data) return fail("session_not_found", 404);
      if (re.data.phase === "ended") return fail("game_over", 409);
      curState = re.data.state;
      curRev = re.data.rev;
    }
    if (newRev < 0) return fail("conflict", 409);

    // Audit day votes (votes table; PK blocks duplicates / re-voting).
    if (body.type === "cast_vote") {
      await db.from("votes").upsert(
        { session_id: body.sessionId, round: newState.round, phase: newState.phase, voter_id: me!.id, target_id: body.target },
        { onConflict: "session_id,round,phase,voter_id", ignoreDuplicates: true },
      );
    }

    // Owner-only secret feedback for the actor (e.g. the seer's instant result).
    let mySecret: unknown;
    if (me) {
      mySecret = sualahModule.derivePlayerSecret(newState, me.id);
      await db
        .from("player_secrets")
        .update({ secret: mySecret, updated_at: new Date().toISOString() })
        .eq("session_id", body.sessionId)
        .eq("player_id", me.id);
    }

    const roomRef = { id: room.data.id, code: room.data.code };

    // host_remove may end the game immediately (§7).
    if (newState.phase === "ended") {
      await db.from("rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", room.data.id);
      await refreshSecrets(db, room.data.id, body.sessionId, newState);
      await broadcast(room.data.code, [
        { event: "state_update", payload: sualahModule.derivePublicState(newState) },
        { event: "secret_changed", payload: {} },
      ]);
      return json({ ok: true, ended: true, secret: mySecret });
    }

    // Early advance when everyone required has acted (§4.2).
    let advanced = false;
    if (sualahModule.isPhaseComplete(newState)) {
      const advancedState = sualahModule.onPhaseTimeout(newState);
      const deadline = nextDeadline(advancedState, Date.now());
      advanced = await persistAndBroadcast(db, roomRef, body.sessionId, advancedState, deadline, newRev);
    } else if (body.type === "host_remove") {
      // A removal changes the public roster even without a phase change.
      await broadcast(room.data.code, [{ event: "state_update", payload: sualahModule.derivePublicState(newState) }]);
    }

    return json({ ok: true, advanced, secret: mySecret });
  } catch (e) {
    log({ fn: "game-action", error: String(e) });
    return fail("internal", 500);
  }
});
