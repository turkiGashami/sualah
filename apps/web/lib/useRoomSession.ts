"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureAnon } from "./auth";
import { fetchRoomByCode, fetchSessionByRoom, fetchPlayers, type PlayerRow, type SessionPublicRow } from "./data";
import { subscribeRoom } from "./realtime";
import { api } from "./api";
import type { PublicState } from "@sualah/game-core";

interface Options {
  advanceOnExpire?: boolean;
  onReaction?: (emoji: string) => void;
  onPhaseChange?: (phase: string) => void;
}

export interface RoomSession {
  ready: boolean;
  notFound: boolean;
  uid: string | null;
  roomId: string | null;
  hostId: string | null;
  sessionId: string | null;
  pub: PublicState | null;
  deadlineAt: string | null;
  phase: string | null;
  status: string;
  players: PlayerRow[];
  nameOf: (id: string | null | undefined) => string;
  refresh: () => void;
}

export function useRoomSession(code: string, opts: Options = {}): RoomSession {
  const [uid, setUid] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("lobby");
  const [notFound, setNotFound] = useState(false);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [session, setSession] = useState<SessionPublicRow | null>(null);

  const advancing = useRef(false);
  const cbRef = useRef(opts);
  cbRef.current = opts;
  const lastPhase = useRef<string | null>(null);

  const refreshSession = useCallback(async (rid: string) => {
    const s = await fetchSessionByRoom(rid);
    setSession(s);
    if (s && s.phase !== lastPhase.current) {
      lastPhase.current = s.phase;
      cbRef.current.onPhaseChange?.(s.phase);
    }
  }, []);
  const refreshPlayers = useCallback(async (rid: string) => setPlayers(await fetchPlayers(rid)), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await ensureAnon();
      if (cancelled) return;
      setUid(id);
      const room = await fetchRoomByCode(code);
      if (!room) {
        setNotFound(true);
        return;
      }
      setRoomId(room.id);
      setHostId(room.host_id);
      setStatus(room.status);
      await refreshPlayers(room.id);
      await refreshSession(room.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [code, refreshPlayers, refreshSession]);

  useEffect(() => {
    if (!roomId) return;
    return subscribeRoom(code, {
      onState: () => void refreshSession(roomId),
      onGameStarted: () => {
        setStatus("active");
        void refreshSession(roomId);
      },
      onLobby: () => void refreshPlayers(roomId),
      onReaction: (p) => cbRef.current.onReaction?.(p.emoji),
    });
  }, [roomId, code, refreshSession, refreshPlayers]);

  // Backup timer: when the server deadline passes, nudge advance-phase. The
  // server's optimistic guard makes concurrent nudges (TV + phones) harmless.
  useEffect(() => {
    if (!opts.advanceOnExpire || !session || session.phase === "ended" || !session.phase_deadline_at) return;
    const sid = session.id;
    const deadline = Date.parse(session.phase_deadline_at);
    const t = setInterval(() => {
      if (deadline - Date.now() <= 0 && !advancing.current) {
        advancing.current = true;
        void api
          .advance(sid)
          .catch(() => {})
          .finally(() => {
            advancing.current = false;
          });
      }
    }, 500);
    return () => clearInterval(t);
  }, [session, opts.advanceOnExpire]);

  const nameOf = useCallback(
    (id: string | null | undefined) => players.find((p) => p.id === id)?.nickname ?? "؟",
    [players],
  );

  return {
    ready: uid !== null && roomId !== null,
    notFound,
    uid,
    roomId,
    hostId,
    sessionId: session?.id ?? null,
    pub: session?.public_state ?? null,
    deadlineAt: session?.phase_deadline_at ?? null,
    phase: session?.phase ?? null,
    status,
    players,
    nameOf,
    refresh: () => {
      if (roomId) void refreshSession(roomId);
    },
  };
}
