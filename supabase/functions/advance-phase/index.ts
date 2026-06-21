// advance-phase — idempotent timer endpoint. Called by the TV (and any phone as
// backup) when the phase deadline passes. Advances at most once per phase via an
// optimistic phase/round guard; honours a +2s grace (§4.2).
import { preflight, json, fail } from "../_shared/http.ts";
import { admin, getUserId } from "../_shared/supabase.ts";
import { nextDeadline, persistAndBroadcast, log } from "../_shared/engine.ts";
import { sualahModule } from "../_shared/game-core.js";
import { advanceBody } from "../_shared/validate.ts";

const GRACE_MS = 2000;

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  try {
    const uid = await getUserId(req);
    if (!uid) return fail("unauthorized", 401);

    const parsed = advanceBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("bad_request", 400, parsed.error.message);
    const { sessionId, force } = parsed.data;
    const db = admin();

    const session = await db.from("game_sessions").select("*").eq("id", sessionId).single();
    if (session.error || !session.data) return fail("session_not_found", 404);
    if (session.data.phase === "ended") return json({ ok: true, ended: true, advanced: false });

    const room = await db.from("rooms").select("*").eq("id", session.data.room_id).single();
    if (room.error || !room.data) return fail("room_not_found", 404);

    // Authorization: host, or any player in this room (backup caller).
    const isHost = room.data.host_id === uid;
    const isPlayer = isHost
      ? true
      : !!(await db.from("players").select("id").eq("room_id", room.data.id).eq("auth_uid", uid).maybeSingle()).data;
    if (!isPlayer) return fail("forbidden", 403);

    const now = Date.now();
    const deadlineMs = session.data.phase_deadline_at ? Date.parse(session.data.phase_deadline_at) : null;
    const complete = sualahModule.isPhaseComplete(session.data.state);
    // The host may FORCE-skip the current phase at any time. Otherwise block
    // only if the deadline is clearly in the future and the phase isn't already
    // complete (the grace lets callers fire up to 2s early).
    const forced = force === true && isHost;
    if (!forced && deadlineMs != null && now < deadlineMs - GRACE_MS && !complete) {
      return json({ ok: true, advanced: false, reason: "not_yet" });
    }

    const advancedState = sualahModule.onPhaseTimeout(session.data.state);
    const deadline = nextDeadline(advancedState, now);
    const applied = await persistAndBroadcast(
      db,
      { id: room.data.id, code: room.data.code },
      sessionId,
      advancedState,
      deadline,
      session.data.rev,
    );

    log({ fn: "advance-phase", roomCode: room.data.code, sessionId, from: session.data.phase, to: advancedState.phase, applied });
    return json({ ok: true, advanced: applied, phase: advancedState.phase });
  } catch (e) {
    log({ fn: "advance-phase", error: String(e) });
    return fail("internal", 500);
  }
});
