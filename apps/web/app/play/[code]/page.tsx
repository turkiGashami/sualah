"use client";
import { useEffect, useState } from "react";
import { useRoomSession } from "@/lib/useRoomSession";
import { useCountdown } from "@/lib/useCountdown";
import { fetchMySecret } from "@/lib/data";
import { api, ApiError } from "@/lib/api";
import { ui, roleLabel, roleTagline, phaseLabel } from "@/lib/strings";
import { RoleMark, Crescent, SaduDiamond, SaduBand } from "@/components/art";
import { HowToPlay } from "@/components/HowToPlay";
import type { Phase, PlayerSecret, PublicPlayer, Role } from "@sualah/game-core";

const playerKey = (code: string) => `sualah:player:${code}`;
type Tone = "ink" | "oxblood" | "olive";
const toneClass: Record<Tone, string> = { ink: "text-ink", oxblood: "text-oxblood", olive: "text-olive" };

export default function PlayPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [secret, setSecret] = useState<PlayerSecret | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const room = useRoomSession(code, { advanceOnExpire: true });

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);
  useEffect(() => {
    if (room.sessionId && playerId) void fetchMySecret(room.sessionId).then(setSecret);
  }, [room.sessionId, room.phase, playerId]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  if (room.notFound) return <Screen>الغرفة غير موجودة أو انتهت اللعبة</Screen>;
  if (!room.ready) return <Screen>{ui.connecting}</Screen>;

  if (!playerId) {
    return (
      <JoinForm
        code={code}
        started={room.status !== "lobby"}
        onJoined={(id) => {
          localStorage.setItem(playerKey(code), id);
          setPlayerId(id);
        }}
        onError={flash}
      />
    );
  }

  const pub = room.pub;
  const phase = room.phase as Phase | null;
  const me = pub?.players.find((p) => p.id === playerId);
  const dead = me ? !me.alive : false;

  let body: React.ReactNode;
  if (!pub || !phase || room.status === "lobby") {
    body = <Screen art={<Crescent className="h-20 w-20 text-ink/60" />}>{ui.waiting}</Screen>;
  } else if (dead) {
    body = <GhostView sessionId={room.sessionId!} room={room} onError={flash} />;
  } else if (phase === "role_reveal") {
    body = <RoleCard secret={secret} nameOf={room.nameOf} />;
  } else if (phase === "night") {
    body = <NightUI sessionId={room.sessionId!} secret={secret} players={pub.players} self={playerId} room={room} setSecret={setSecret} onError={flash} />;
  } else if (phase === "dawn") {
    body = pub.lastNight?.victimId ? (
      <Screen art={<Sun />} tone="oxblood">{ui.victimDawn(room.nameOf(pub.lastNight.victimId))}</Screen>
    ) : (
      <Screen art={<Sun />} tone="olive">{ui.safeDawn}</Screen>
    );
  } else if (phase === "discussion") {
    body = <Screen art={<SaduDiamond className="h-14 w-14 text-oxblood" />}>ناقشوا وجهاً لوجه… من المشبوه؟</Screen>;
  } else if (phase === "vote" || phase === "runoff") {
    body = <VoteUI sessionId={room.sessionId!} pub={pub} self={playerId} room={room} onError={flash} />;
  } else if (phase === "execution") {
    const e = pub.lastVote?.eliminatedId;
    const r = pub.players.find((p) => p.id === e)?.role as Role | undefined;
    body = e && r ? (
      <Screen art={<RoleMark role={r} className="h-20 w-20 text-oxblood" />} tone="oxblood">{ui.expelled(room.nameOf(e), roleLabel[r])}</Screen>
    ) : (
      <Screen tone="olive">{ui.noExpel}</Screen>
    );
  } else if (phase === "ended") {
    body = <EndedView pub={pub} self={playerId} />;
  } else {
    body = <Screen>{phaseLabel[phase]}</Screen>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col">
      <SaduBand className="h-10 w-full shrink-0" />
      <div className="flex flex-1 flex-col p-4">
        <TopBar phase={phase} deadlineAt={room.deadlineAt} round={pub?.round ?? 0} dead={dead} />
        <div className="flex flex-1 flex-col">{body}</div>
      </div>
      {toast && toast !== "…" && (
        <div className="fixed inset-x-0 bottom-5 mx-auto w-fit rounded-md border-2 border-ink bg-oxblood px-4 py-2 text-sm font-bold text-bone shadow-hardsm">{toast}</div>
      )}
      <HowToPlay />
    </main>
  );
}

function TopBar({ phase, deadlineAt, round, dead }: { phase: Phase | null; deadlineAt: string | null; round: number; dead: boolean }) {
  const s = useCountdown(deadlineAt);
  return (
    <header className="mb-5 flex items-center justify-between">
      <span className="font-title text-base text-ink">{phase ? phaseLabel[phase] : ""}</span>
      {round > 0 && <span className="pill">{ui.round(round)}</span>}
      <span className="font-stage text-xl text-oxblood">{dead ? "👻" : s != null ? `${s}″` : ""}</span>
    </header>
  );
}

function Screen({ children, art, tone = "ink" }: { children: React.ReactNode; art?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center animate-riseIn">
      {art}
      <p className={`font-stage text-3xl ${toneClass[tone]}`}>{children}</p>
    </div>
  );
}

function Sun() {
  return <div className="h-24 w-24 rounded-full border-4 border-ink bg-clay" />;
}

function JoinForm({ code, started, onJoined, onError }: { code: string; started: boolean; onJoined: (id: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="flex min-h-screen flex-col">
      <SaduBand className="h-10 w-full" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-7 p-6 text-center">
        <div>
          <h1 className="font-title text-5xl text-ink">{ui.appName}</h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="h-1 w-8 bg-oxblood" />
            <SaduDiamond className="h-4 w-4 text-oxblood" />
            <span className="h-1 w-8 bg-oxblood" />
          </div>
        </div>
        <p className="font-bold text-ash">
          الغرفة <span className="font-stage text-2xl tracking-widest text-oxblood">{code}</span>
        </p>
        {started && <p className="text-sm font-bold text-oxblood">اللعبة بدأت — ستنضم كروح مشاهد للجولة القادمة</p>}
        <form
          className="card flex w-full flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (name.trim().length < 2) return;
            setBusy(true);
            try {
              const r = await api.joinRoom(code, name.trim());
              if (r.playerId) onJoined(r.playerId);
              else onError("انضممت كمشاهد");
            } catch (err) {
              onError(err instanceof ApiError ? err.code : "join_failed");
              setBusy(false);
            }
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="اسمك" className="input text-center font-title text-xl" />
          <button className="btn-primary" disabled={busy || name.trim().length < 2}>
            {ui.join}
          </button>
        </form>
      </div>
      <HowToPlay />
    </main>
  );
}

function RoleCard({ secret, nameOf }: { secret: PlayerSecret | null; nameOf: (id: string) => string }) {
  if (!secret) return <Screen>{ui.connecting}</Screen>;
  const role = secret.role as Role;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center animate-riseIn">
      <div className="grid h-36 w-36 place-items-center rounded-full border-2 border-ink bg-parch shadow-hard">
        <RoleMark role={role} className={`h-20 w-20 ${role === "ghoul" ? "text-oxblood" : "text-ink"}`} />
      </div>
      <h2 className="font-stage text-5xl text-ink">{roleLabel[role]}</h2>
      <p className="max-w-xs text-ash">{roleTagline[role]}</p>
      {secret.role === "ghoul" && secret.mates.length > 0 && (
        <p className="rounded-md border-2 border-ink bg-oxblood px-4 py-2 font-bold text-bone">رفاقك من الغيلان: {secret.mates.map(nameOf).join("، ")}</p>
      )}
      <p className="mt-2 text-sm font-bold text-oxblood">{ui.dontShowPhone}</p>
    </div>
  );
}

function PlayerButtons({ players, nameOf, exclude, onlyIds, selected, onPick }: { players: PublicPlayer[]; nameOf: (id: string) => string; exclude?: string; onlyIds?: string[] | null; selected: string | null; onPick: (id: string) => void }) {
  const list = players.filter((p) => p.alive && p.id !== exclude && (!onlyIds || onlyIds.includes(p.id)));
  return (
    <div className="grid w-full grid-cols-2 gap-2.5">
      {list.map((p) => (
        <button key={p.id} onClick={() => onPick(p.id)} className={`tile px-4 py-4 text-lg ${selected === p.id ? "tile-on" : ""}`}>
          {p.id === selected ? "✓ " : ""}
          {nameOf(p.id)}
        </button>
      ))}
    </div>
  );
}

function NightUI({ sessionId, secret, players, self, room, setSecret, onError }: { sessionId: string; secret: PlayerSecret | null; players: PublicPlayer[]; self: string; room: ReturnType<typeof useRoomSession>; setSecret: (s: PlayerSecret) => void; onError: (m: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    setSelected(null);
  }, [room.phase, room.pub?.round]);

  if (!secret) return <Screen>{ui.connecting}</Screen>;

  if (secret.role === "villager") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Crescent className="h-24 w-24 text-ink/60" />
        <p className="font-stage text-3xl text-ink">{ui.sleeping}</p>
        <button onClick={() => onError("…")} className="btn-ghost">
          {ui.fakeTap}
        </button>
      </div>
    );
  }

  const title = secret.role === "ghoul" ? ui.pickVictim : secret.role === "seer" ? ui.pickInspect : ui.pickProtect;
  const pick = async (id: string) => {
    setSelected(id);
    try {
      if (secret.role === "ghoul") await api.monsterPick(sessionId, id);
      else if (secret.role === "seer") {
        const r = await api.seerInspect(sessionId, id);
        if (r?.secret) setSecret(r.secret as PlayerSecret);
      } else if (secret.role === "guard") await api.guardProtect(sessionId, id);
    } catch (e) {
      setSelected(null);
      onError(e instanceof ApiError ? e.code : "action_failed");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h2 className="flex items-center justify-center gap-2 text-center font-stage text-3xl text-ink">
        <RoleMark role={secret.role} className={`h-7 w-7 ${secret.role === "ghoul" ? "text-oxblood" : "text-ink"}`} />
        {title}
      </h2>
      {secret.role === "ghoul" && secret.mates.length > 0 && <p className="text-center text-sm font-bold text-oxblood">رفاقك: {secret.mates.map(room.nameOf).join("، ")}</p>}
      <PlayerButtons players={players} nameOf={room.nameOf} exclude={secret.role === "guard" ? undefined : self} selected={selected} onPick={pick} />
      {secret.role === "seer" && secret.results.length > 0 && (
        <div className="mt-2 space-y-1.5 text-center">
          {secret.results.map((r, i) => (
            <p key={i} className={`rounded-md border-2 border-ink px-3 py-1.5 font-bold ${r.isMonster ? "bg-oxblood text-bone" : "bg-olive text-bone"}`}>
              {room.nameOf(r.target)}: {r.isMonster ? "من الوحوش" : "بريء"}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function VoteUI({ sessionId, pub, self, room, onError }: { sessionId: string; pub: NonNullable<ReturnType<typeof useRoomSession>["pub"]>; self: string; room: ReturnType<typeof useRoomSession>; onError: (m: string) => void }) {
  const [voted, setVoted] = useState(false);
  useEffect(() => {
    setVoted(false);
  }, [room.phase, pub.round]);

  if (voted) return <Screen art={<SaduDiamond className="h-12 w-12 text-olive" />} tone="olive">{ui.youVoted}</Screen>;

  const onlyIds = room.phase === "runoff" ? pub.runoffCandidates : null;
  const cast = async (target: string) => {
    setVoted(true);
    try {
      await api.castVote(sessionId, target);
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_voted") return;
      setVoted(false);
      onError(e instanceof ApiError ? e.code : "vote_failed");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h2 className="text-center font-stage text-3xl text-ink">{ui.chooseToExpel}</h2>
      <PlayerButtons players={pub.players} nameOf={room.nameOf} exclude={self} onlyIds={onlyIds} selected={null} onPick={cast} />
      <button onClick={() => cast("skip")} className="btn-ghost mt-1">
        {ui.skip}
      </button>
    </div>
  );
}

function GhostView({ sessionId, room, onError }: { sessionId: string; room: ReturnType<typeof useRoomSession>; onError: (m: string) => void }) {
  const [roles, setRoles] = useState<{ id: string; role: string; alive: boolean }[]>([]);
  useEffect(() => {
    void api.ghostView(sessionId).then((r) => setRoles(r.ghost.players)).catch(() => {});
  }, [sessionId, room.phase]);

  const react = (emoji: string) => api.reaction(sessionId, emoji).catch(() => onError("…"));

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="text-center">
        <p className="font-stage text-4xl text-ink">👻 {ui.ghostMode}</p>
        <p className="mt-1 text-sm font-bold text-ash">{ui.ghostBlurb}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {roles.map((p) => (
          <div key={p.id} className={`flex items-center gap-2 rounded-md border-2 border-ink px-3 py-2 text-sm font-bold ${p.alive ? "bg-parch text-ink" : "bg-oxblood/15 text-oxblood line-through"}`}>
            <RoleMark role={p.role as Role} className={`h-5 w-5 ${p.role === "ghoul" ? "text-oxblood" : "text-ink"}`} />
            {room.nameOf(p.id)} — {roleLabel[p.role as Role]}
          </div>
        ))}
      </div>
      <div className="mt-auto flex justify-center gap-4 pt-4 text-5xl">
        {["😱", "🔥", "😂", "👀"].map((e) => (
          <button key={e} onClick={() => react(e)} className="transition active:scale-90">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function EndedView({ pub, self }: { pub: NonNullable<ReturnType<typeof useRoomSession>["pub"]>; self: string }) {
  const mine = pub.players.find((p) => p.id === self)?.role as Role | undefined;
  const win = pub.winner;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center animate-riseIn">
      <h2 className={`font-stage text-4xl ${win === "village" ? "text-olive" : "text-oxblood"}`}>{win === "village" ? ui.villageWin : ui.monstersWin}</h2>
      {mine && (
        <div className="flex flex-col items-center gap-2 font-bold text-ash">
          <RoleMark role={mine} className={`h-14 w-14 ${mine === "ghoul" ? "text-oxblood" : "text-ink"}`} />
          <span>دورك كان: {roleLabel[mine]}</span>
        </div>
      )}
    </div>
  );
}
