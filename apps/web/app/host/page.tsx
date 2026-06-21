"use client";
import { useEffect, useState } from "react";
import { ensureAnon } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { fetchPlayers, type PlayerRow } from "@/lib/data";
import { subscribeRoom } from "@/lib/realtime";
import { Qr } from "@/components/Qr";
import { SaduBand } from "@/components/art";
import { ui } from "@/lib/strings";
import { DISCUSSION_OPTIONS_MS } from "@sealah/game-core";

export default function HostPage() {
  const [code, setCode] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [discussionMs, setDiscussionMs] = useState(180_000);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await ensureAnon();
        const r = await api.createRoom();
        setCode(r.code);
        setRoomId(r.roomId);
      } catch (e) {
        setError(e instanceof ApiError ? e.code : String(e));
      }
    })();
  }, []);

  // Test-only affordance: /host?fast=1 shortens timer phases so the Playwright
  // e2e runs in seconds. No effect in normal use.
  useEffect(() => {
    if (!roomId) return;
    if (new URLSearchParams(window.location.search).get("fast") !== "1") return;
    void api.updateSettings(roomId, {
      roleRevealMs: 12000,
      nightMs: 30000,
      dawnMs: 2000,
      discussionMs: 2500,
      voteMs: 30000,
      runoffMs: 20000,
      executionMs: 2500,
    });
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !code) return;
    void fetchPlayers(roomId).then(setPlayers);
    return subscribeRoom(code, {
      onLobby: () => void fetchPlayers(roomId).then(setPlayers),
      onGameStarted: () => {
        window.location.href = `/tv/${code}`;
      },
    });
  }, [roomId, code]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = code ? `${origin}/play/${code}` : "";

  async function start() {
    if (!roomId) return;
    setStarting(true);
    setError(null);
    try {
      await api.start(roomId);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : String(e));
      setStarting(false);
    }
  }

  async function changeDiscussion(ms: number) {
    setDiscussionMs(ms);
    if (roomId) await api.updateSettings(roomId, { discussionMs: ms });
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <p className="font-bold text-oxblood">تعذّر إنشاء الغرفة: {error}</p>
      </main>
    );
  }
  if (!code) {
    return <main className="grid min-h-screen place-items-center font-title text-ash">{ui.connecting}</main>;
  }

  const ready = players.length >= 5;

  return (
    <main className="flex min-h-screen flex-col">
      <SaduBand className="h-10 w-full" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-6">
        <header className="card flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-ash">{ui.scanToJoin}</p>
            <p data-testid="room-code" className="font-stage text-7xl leading-tight tracking-[0.12em] text-oxblood">
              {code}
            </p>
          </div>
          <div className="rounded-md border-2 border-ink bg-bone p-2">
            <Qr value={joinUrl} size={132} />
          </div>
        </header>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-title text-2xl text-ink">
              {ui.players} <span className="text-ash">({players.length})</span>
            </h2>
            <span className={`pill ${ready ? "bg-olive text-bone" : ""}`}>{ready ? "جاهز" : ui.needFive}</span>
          </div>
          {players.length === 0 ? (
            <p className="py-4 text-center font-bold text-ash">{ui.waiting}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {players.map((p) => (
                <li key={p.id} className="tile flex items-center justify-between px-3 py-2.5">
                  <span className="truncate">{p.nickname}</span>
                  <button
                    onClick={() => api.kick(roomId!, p.id).then(() => fetchPlayers(roomId!).then(setPlayers))}
                    className="text-oxblood transition hover:text-oxbloodlit"
                    aria-label="اطرد"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 font-title text-2xl text-ink">{ui.settings}</h2>
          <p className="mb-2 text-sm font-bold text-ash">{ui.discussionMin}</p>
          <div className="flex gap-2">
            {DISCUSSION_OPTIONS_MS.map((ms) => (
              <button key={ms} onClick={() => changeDiscussion(ms)} className={`pill ${discussionMs === ms ? "bg-oxblood text-bone" : ""}`}>
                {ms / 60_000} دقائق
              </button>
            ))}
          </div>
        </section>

        <div className="mt-auto flex flex-col gap-3">
          <button onClick={start} disabled={!ready || starting} className="btn-primary text-lg">
            {starting ? "…" : ui.start}
          </button>
          <a href={`/tv/${code}`} target="_blank" rel="noreferrer" className="btn-ghost text-center">
            افتح شاشة العرض ↗
          </a>
        </div>
      </div>
      <SaduBand className="h-10 w-full" />
    </main>
  );
}
