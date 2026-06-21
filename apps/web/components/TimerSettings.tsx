"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_SETTINGS } from "@sualah/game-core";

// Per-phase duration presets. Used in the lobby AND live mid-game (host only).
const ROWS: { key: keyof typeof DEFAULT_SETTINGS; label: string; opts: number[]; unit: "ث" | "د" }[] = [
  { key: "roleRevealMs", label: "كشف الدور", opts: [10000, 15000, 20000], unit: "ث" },
  { key: "nightMs", label: "الليل", opts: [45000, 60000, 90000], unit: "ث" },
  { key: "dawnMs", label: "الفجر", opts: [4000, 6000, 8000], unit: "ث" },
  { key: "discussionMs", label: "النقاش", opts: [120000, 180000, 300000], unit: "د" },
  { key: "voteMs", label: "التصويت", opts: [30000, 45000, 60000], unit: "ث" },
  { key: "runoffMs", label: "إعادة التصويت", opts: [15000, 20000, 30000], unit: "ث" },
  { key: "executionMs", label: "كشف المطرود", opts: [5000, 7000, 10000], unit: "ث" },
];

export function TimerSettings({ roomId, initial }: { roomId: string; initial?: Partial<typeof DEFAULT_SETTINGS> }) {
  const [vals, setVals] = useState<Record<string, number>>({ ...DEFAULT_SETTINGS, ...(initial ?? {}) });

  const pick = async (key: string, v: number) => {
    setVals((s) => ({ ...s, [key]: v }));
    try {
      await api.updateSettings(roomId, { [key]: v });
    } catch {
      /* surfaced elsewhere; keep UI responsive */
    }
  };

  return (
    <div className="space-y-2.5">
      {ROWS.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-ink">{r.label}</span>
          <div className="flex gap-1.5">
            {r.opts.map((o) => (
              <button
                key={o}
                onClick={() => pick(r.key, o)}
                className={`pill ${vals[r.key] === o ? "bg-oxblood text-bone" : ""}`}
              >
                {r.unit === "د" ? o / 60000 : o / 1000}
                {r.unit}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
