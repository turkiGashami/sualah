"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ui } from "@/lib/strings";
import { Brand, SaduBand } from "@/components/art";
import { HowToPlay } from "@/components/HowToPlay";

export default function Home() {
  const [code, setCode] = useState("");
  const router = useRouter();
  const ready = code.trim().length === 4;

  return (
    <main className="flex min-h-screen flex-col">
      <SaduBand className="h-12 w-full" />

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-10 animate-riseIn">
          <div className="text-center">
            <Brand />
            <p className="mt-4 font-title text-xl text-oxblood">{ui.tagline}</p>
          </div>

          <div className="flex w-full flex-col gap-4">
            <Link href="/host" className="btn-primary text-center text-lg">
              {ui.hostCta}
            </Link>

            <div className="flex items-center gap-3 text-ash">
              <span className="h-0.5 flex-1 bg-ink/20" />
              <span className="text-xs font-bold">أو</span>
              <span className="h-0.5 flex-1 bg-ink/20" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (ready) router.push(`/play/${code.trim().toUpperCase()}`);
              }}
              className="card flex flex-col gap-3"
            >
              <label className="text-center text-sm font-bold text-ash">{ui.enterCode}</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                maxLength={4}
                inputMode="text"
                autoCapitalize="characters"
                placeholder="— — — —"
                className="input text-center font-stage text-4xl tracking-[0.4em] text-oxblood"
              />
              <button className="btn-ghost" disabled={!ready}>
                {ui.joinCta}
              </button>
            </form>
          </div>
        </div>
      </div>

      <SaduBand className="h-12 w-full" />
      <HowToPlay />
    </main>
  );
}
