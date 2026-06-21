// Hand-built SVG art for Sualah — Sadu (Bedouin weave) motifs + per-role marks.
// Role marks use currentColor so Tailwind text-* controls the tint.
import type { Role } from "@sualah/game-core";

type SvgProps = { className?: string };

/* ── Sadu weave band (tiles horizontally) ───────────────────────────────── */

export function SaduBand({
  className,
  bg = "#e7d6b0",
  diamond = "#9a3325",
  accent = "#1c1712",
}: {
  className?: string;
  bg?: string;
  diamond?: string;
  accent?: string;
}) {
  const id = `sadu-${diamond.slice(1)}-${bg.slice(1)}-${accent.slice(1)}`;
  return (
    <svg width="100%" viewBox="0 0 680 48" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
          <rect width="48" height="48" fill={bg} />
          <path d="M24 3 L45 24 L24 45 L3 24 Z" fill={diamond} />
          <path d="M24 12 L36 24 L24 36 L12 24 Z" fill={bg} />
          <path d="M24 18 L30 24 L24 30 L18 24 Z" fill={accent} />
          <rect x="0" y="20" width="8" height="8" fill={accent} />
          <rect x="40" y="20" width="8" height="8" fill={accent} />
          <path d="M24 0 L30 6 L24 12 L18 6 Z" fill={accent} />
          <path d="M24 36 L30 42 L24 48 L18 42 Z" fill={accent} />
        </pattern>
      </defs>
      <rect width="680" height="48" fill={`url(#${id})`} />
    </svg>
  );
}

// Single nested-diamond motif for accents/bullets (themeable via text color).
export function SaduDiamond({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
      <path d="M24 4 L44 24 L24 44 L4 24 Z" />
      <path d="M24 15 L33 24 L24 33 L15 24 Z" />
    </svg>
  );
}

/* ── Role marks ─────────────────────────────────────────────────────────── */

function GhoulMark({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17C11 11 11 7 13 4" />
      <path d="M49 17C53 11 53 7 51 4" />
      <path d="M5 33C17 17 47 17 59 33C47 49 17 49 5 33Z" />
      <circle cx="32" cy="33" r="9.5" fill="currentColor" stroke="none" />
      <path d="M32 25.5C33.6 28 33.6 38 32 40.5C30.4 38 30.4 28 32 25.5Z" fill="#e7d6b0" stroke="none" />
    </svg>
  );
}
function SeerMark({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 34C19 23 45 23 54 34C45 45 19 45 10 34Z" />
      <circle cx="32" cy="34" r="6" fill="currentColor" stroke="none" />
      <path d="M32 8V15M32 53V60M9 18l5 5M55 18l-5 5M6 47l6-4M58 47l-6-4" />
    </svg>
  );
}
function GuardMark({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 5L55 13V31C55 45 45 54 32 60C19 54 9 45 9 31V13Z" />
      <path d="M32 19V45M23 27h18" />
    </svg>
  );
}
function VillagerMark({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 52L32 12L58 52" />
      <path d="M4 52h56" />
      <path d="M25 52c0-9 14-9 14 0" />
      <path d="M32 12v22" />
    </svg>
  );
}

const MARKS: Record<Role, (p: SvgProps) => JSX.Element> = {
  ghoul: GhoulMark,
  seer: SeerMark,
  guard: GuardMark,
  villager: VillagerMark,
};

export function RoleMark({ role, className }: { role: Role; className?: string }) {
  const Mark = MARKS[role];
  return <Mark className={className} />;
}

export function EyeMark({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 64 40" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20C16 4 48 4 60 20C48 36 16 36 4 20Z" />
      <circle cx="32" cy="20" r="7.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── Night motifs (for the TV's dark phases) ─────────────────────────────── */

export function Crescent({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M62 6A46 46 0 1 0 62 94A36 36 0 1 1 62 6Z" fill="currentColor" />
    </svg>
  );
}

const STARS = [
  [6, 12, 1.1], [14, 28, 0.8], [21, 8, 1.4], [28, 20, 0.7], [34, 36, 1], [9, 44, 0.9],
  [41, 14, 1.2], [48, 30, 0.8], [55, 10, 1.1], [62, 24, 0.7], [69, 16, 1.3], [76, 34, 0.9],
  [83, 12, 1], [90, 26, 1.2], [94, 8, 0.8], [12, 60, 0.7], [25, 52, 1.1], [38, 64, 0.9],
  [52, 50, 0.8], [66, 58, 1.2], [78, 52, 0.7], [88, 62, 1], [46, 6, 0.9], [60, 40, 0.7],
] as const;

export function Stars({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className} aria-hidden>
      {STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#f5ecd6" className="animate-twinkle" style={{ animationDelay: `${(i % 7) * 0.6}s` }} />
      ))}
    </svg>
  );
}

/* ── Brand wordmark ─────────────────────────────────────────────────────── */

export function Brand({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className ?? ""}`}>
      <h1 className="font-title text-7xl font-bold leading-none text-ink">سُعلاة</h1>
      <div className="mt-3 flex items-center gap-2">
        <span className="h-1 w-12 bg-oxblood" />
        <SaduDiamond className="h-4 w-4 text-oxblood" />
        <span className="h-1 w-12 bg-oxblood" />
      </div>
    </div>
  );
}
