"use client";
import { useEffect, useRef, useState } from "react";
import { useRoomSession } from "@/lib/useRoomSession";
import { useCountdown } from "@/lib/useCountdown";
import { sound } from "@/lib/sounds";
import { Qr } from "@/components/Qr";
import { SaduBand, Crescent, Stars, RoleMark, Brand, SaduDiamond } from "@/components/art";
import { TimerSettings } from "@/components/TimerSettings";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { ui, phaseLabel, roleLabel } from "@/lib/strings";
import type { Phase, Role } from "@sualah/game-core";

interface Floater {
  id: number;
  emoji: string;
  x: number;
}

const isDark = (phase: Phase | null, winner?: string | null) =>
  phase === "night" || phase === "execution" || (phase === "ended" && winner === "monsters");

function bgClass(phase: Phase | null, winner?: string | null): string {
  if (phase === "execution") return "bg-oxblood text-bone";
  if (isDark(phase, winner)) return "bg-ink text-bone";
  return "bg-sand text-ink";
}

export default function TvPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [audioOn, setAudioOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const floatId = useRef(0);

  const room = useRoomSession(code, {
    advanceOnExpire: true,
    onReaction: (emoji) => {
      const id = floatId.current++;
      setFloaters((f) => [...f, { id, emoji, x: 8 + Math.random() * 84 }]);
      setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 4200);
    },
    onPhaseChange: (phase) => {
      if (sound.isEnabled) sound.forPhase(phase);
    },
  });

  const secondsLeft = useCountdown(room.deadlineAt);

  useEffect(() => {
    if (audioOn && room.phase === "ended") sound.forPhase("ended", room.pub?.winner ?? null);
  }, [audioOn, room.phase, room.pub?.winner]);

  useEffect(() => {
    if (room.phase === "ended") track("game_ended", { winner: room.pub?.winner ?? "unknown" });
  }, [room.phase]);

  if (room.notFound) return <main className="grid min-h-screen place-items-center font-title text-3xl text-ash">الغرفة غير موجودة أو انتهت</main>;
  if (!room.ready) return <main className="grid min-h-screen place-items-center font-title text-3xl text-ash">{ui.connecting}</main>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = `${origin}/play/${code}`;
  const inLobby = !room.sessionId || room.status === "lobby";
  const phase = room.phase as Phase | null;
  const dark = isDark(phase, room.pub?.winner);
  const isHost = !!room.uid && room.uid === room.hostId;

  return (
    <main className={`relative flex min-h-screen flex-col overflow-hidden transition-colors duration-700 ${bgClass(phase, room.pub?.winner)}`}>
      <SaduBand className="h-14 w-full shrink-0" />

      {phase === "night" && <Stars className="pointer-events-none absolute inset-x-0 top-12 h-1/2 w-full opacity-80" />}

      {!audioOn && (
        <button onClick={async () => { await sound.enable(); setAudioOn(true); if (room.phase) sound.forPhase(room.phase, room.pub?.winner ?? null); }} className="absolute inset-0 z-30 grid place-items-center bg-ink/85">
          <span className="btn-primary text-2xl">🔊 {ui.tapWhenReady}</span>
        </button>
      )}

      <div className="pointer-events-none absolute inset-0 z-20">
        {floaters.map((f) => (
          <span key={f.id} className="absolute bottom-24 animate-floatUp text-7xl" style={{ left: `${f.x}%` }}>
            {f.emoji}
          </span>
        ))}
      </div>

      {isHost && !inLobby && (
        <div className="absolute left-4 top-20 z-40 flex flex-col gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-full border-2 border-ink bg-parch px-4 py-2 text-sm font-bold text-ink shadow-hardsm transition active:scale-95"
          >
            ⚙ الإعدادات
          </button>
          <button
            onClick={() => room.sessionId && api.advance(room.sessionId, true)}
            className="rounded-full border-2 border-ink bg-oxblood px-4 py-2 text-sm font-bold text-bone shadow-hardsm transition active:scale-95"
          >
            ⏭ تجاوز المرحلة
          </button>
        </div>
      )}

      {showSettings && isHost && room.roomId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/70 p-4" onClick={() => setShowSettings(false)}>
          <div className="my-8 w-full max-w-md rounded-lg border-2 border-ink bg-sand p-5 shadow-hard" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-title text-2xl text-ink">مدة المراحل</h2>
              <button onClick={() => setShowSettings(false)} className="font-bold text-ink" aria-label="إغلاق">
                ✕
              </button>
            </div>
            <TimerSettings roomId={room.roomId} />
            <p className="mt-3 text-xs text-ash">يُطبَّق فوراً على الجولة الحالية والقادمة.</p>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col">
        {inLobby ? <Lobby code={code} joinUrl={joinUrl} players={room.players.map((p) => p.nickname)} /> : <GameStage room={room} secondsLeft={secondsLeft} dark={dark} />}
      </div>

      <SaduBand className="h-14 w-full shrink-0" />
    </main>
  );
}

function Ring({ n, dark }: { n: number | null; dark: boolean }) {
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0">
        <circle cx="50" cy="50" r="45" fill="none" stroke={dark ? "rgba(245,236,214,0.2)" : "rgba(28,23,18,0.15)"} strokeWidth="6" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#b8402e" strokeWidth="6" strokeLinecap="round" strokeDasharray="283" strokeDashoffset="64" transform="rotate(-90 50 50)" />
      </svg>
      <span className={`font-stage text-4xl ${dark ? "text-bone" : "text-oxblood"}`}>{n ?? "—"}</span>
    </div>
  );
}

function Lobby({ code, joinUrl, players }: { code: string; joinUrl: string; players: string[] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12 p-10 text-center">
      <Brand />
      <div className="flex items-center gap-14">
        <div className="rounded-lg border-2 border-ink bg-bone p-4 shadow-hard">
          <Qr value={joinUrl} size={250} />
        </div>
        <div className="text-right">
          <p className="font-title text-3xl text-oxblood">{ui.scanToJoin}</p>
          <p className="font-stage text-[10rem] leading-none tracking-[0.08em] text-ink">{code}</p>
        </div>
      </div>
      <div className="flex max-w-4xl flex-wrap justify-center gap-3">
        {players.length === 0 ? (
          <p className="font-title text-2xl text-ash">{ui.waiting}</p>
        ) : (
          players.map((n, i) => (
            <span key={i} className="tile px-6 py-3 text-2xl">
              {n}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function GameStage({ room, secondsLeft, dark }: { room: ReturnType<typeof useRoomSession>; secondsLeft: number | null; dark: boolean }) {
  const pub = room.pub!;
  const phase = (room.phase ?? "night") as Phase;
  const timed = phase === "discussion" || phase === "vote" || phase === "runoff" || phase === "night";

  return (
    <div className="flex flex-1 flex-col p-10">
      <header className="flex items-center justify-between">
        <span className={`pill text-xl ${dark ? "border-bone/40 bg-transparent text-bone" : ""}`}>{ui.round(pub.round)}</span>
        <span className="font-stage text-4xl">{phaseLabel[phase]}</span>
        {timed ? <Ring n={secondsLeft} dark={dark} /> : <span className="w-24" />}
      </header>

      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <PhaseCenter room={room} dark={dark} />
      </section>

      <footer className="flex flex-wrap justify-center gap-3">
        {pub.players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 rounded-md border-2 px-4 py-2 text-2xl font-bold ${
              p.alive ? (dark ? "border-bone/40 text-bone" : "border-ink bg-parch text-ink") : "border-oxblood/50 bg-oxblood/15 text-oxblood line-through"
            }`}
          >
            {!p.alive && <span>✕</span>}
            {p.role && <RoleMark role={p.role as Role} className={`h-6 w-6 ${p.role === "ghoul" ? "text-oxbloodlit" : dark ? "text-bone" : "text-ink"}`} />}
            <span>{room.nameOf(p.id)}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}

function PhaseCenter({ room, dark }: { room: ReturnType<typeof useRoomSession>; dark: boolean }) {
  const pub = room.pub!;
  const phase = room.phase as Phase;
  const base = dark ? "text-bone" : "text-ink";

  if (phase === "role_reveal") return <Big art={<SaduDiamond className="h-20 w-20 text-oxblood" />} title="تعرّفوا على أدواركم" sub={ui.dontShowPhone} cls={base} />;
  if (phase === "night") return <Big art={<Crescent className="h-36 w-36 text-bone" />} title={ui.sleeping} sub="ينام الجميع… وتتحرك العفاريت" cls="text-bone" />;
  if (phase === "dawn") {
    const v = pub.lastNight?.victimId;
    return v ? <Big art={<Sun />} title={ui.victimDawn(room.nameOf(v))} cls="text-oxblood" /> : <Big art={<Sun />} title={ui.safeDawn} cls="text-olive" />;
  }
  if (phase === "discussion") return <Big art={<SaduDiamond className="h-16 w-16 text-oxblood" />} title="تكلّموا… من المشبوه؟" cls={base} />;
  if (phase === "vote" || phase === "runoff") return <Big art={<SaduDiamond className="h-16 w-16 text-oxblood" />} title={phase === "runoff" ? "إعادة التصويت" : "صوّتوا من جوالاتكم"} cls={base} />;
  if (phase === "execution") {
    const e = pub.lastVote?.eliminatedId;
    const role = pub.players.find((p) => p.id === e)?.role as Role | undefined;
    return e && role ? <Big art={<RoleMark role={role} className="h-28 w-28 text-bone" />} title={ui.expelled(room.nameOf(e), roleLabel[role])} cls="text-bone" /> : <Big title={ui.noExpel} cls="text-bone" />;
  }
  if (phase === "ended") {
    const win = pub.winner;
    return (
      <div className="flex flex-col items-center gap-8 animate-riseIn">
        <Big title={win === "village" ? ui.villageWin : ui.monstersWin} cls={win === "village" ? "text-olive" : "text-bone"} />
        <div className="flex max-w-5xl flex-wrap justify-center gap-3">
          {pub.players.map((p) => (
            <span key={p.id} className={`flex items-center gap-2 rounded-md border-2 px-4 py-2 text-xl font-bold ${dark ? "border-bone/40 text-bone" : "border-ink bg-parch text-ink"}`}>
              {p.role && <RoleMark role={p.role as Role} className={`h-6 w-6 ${p.role === "ghoul" ? "text-oxbloodlit" : dark ? "text-bone" : "text-ink"}`} />}
              {room.nameOf(p.id)} — {p.role ? roleLabel[p.role as Role] : "؟"}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function Sun() {
  return <div className="h-28 w-28 rounded-full border-4 border-ink bg-clay" />;
}

function Big({ art, title, sub, cls }: { art?: React.ReactNode; title: string; sub?: string; cls: string }) {
  return (
    <div className="flex flex-col items-center gap-6 animate-riseIn">
      {art}
      <h2 className={`max-w-5xl font-stage text-7xl leading-tight ${cls}`}>{title}</h2>
      {sub && <p className="font-title text-3xl opacity-70">{sub}</p>}
    </div>
  );
}
