// Hand-built SVG art for Sualah — Sadu (Bedouin weave) motifs + per-role marks.
// Role marks use currentColor so Tailwind text-* controls the tint.
import type { Role } from "@sualah/game-core";

type SvgProps = { className?: string };

/* ── Sadu weave band (tiles horizontally) ───────────────────────────────── */

export function SaduBand({ className }: { className?: string }) {
  // Authentic Najdi Sadu border: a layered "star" diamond (ink/oxblood/olive)
  // flanked by inward chevrons, between two ink rules — on a cream woven ribbon.
  // Tiled horizontally at natural aspect (scaled to band height) so it never
  // stretches and reads at a comfortable size on any width.
  const C = "#e7d6b0";
  const I = "#1c1712";
  const R = "#9a3325";
  const G = "#5f6f3a";
  const tile =
    `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='56'>` +
    `<rect width='60' height='56' fill='${C}'/>` +
    `<rect x='0' y='6' width='60' height='2.6' fill='${I}'/>` +
    `<rect x='0' y='47.4' width='60' height='2.6' fill='${I}'/>` +
    `<path d='M2 17L13 28L2 39Z' fill='${I}'/>` +
    `<path d='M58 17L47 28L58 39Z' fill='${I}'/>` +
    `<path d='M30 13L47 28L30 43L13 28Z' fill='${I}'/>` +
    `<path d='M30 17.6L41.4 28L30 38.4L18.6 28Z' fill='${R}'/>` +
    `<path d='M30 23L35 28L30 33L25 28Z' fill='${G}'/>` +
    `</svg>`;
  return (
    <div
      className={className}
      aria-hidden
      style={{
        backgroundColor: C,
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(tile)}")`,
        backgroundRepeat: "repeat-x",
        backgroundPosition: "center",
        backgroundSize: "auto 100%",
      }}
    />
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

// Phase icons (dawn / discussion / vote) — same line style as the role marks.
export function SunIcon({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 50h48" />
      <path d="M19 50a13 13 0 0 1 26 0" />
      <path d="M32 23v-7M15 33l-5-4M49 33l5-4M11 44H5M59 44h-6" />
    </svg>
  );
}

export function TalkIcon({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 16h36a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H26l-10 8v-8h-2a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6Z" />
      <circle cx="20" cy="29" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="30" cy="29" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="40" cy="29" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function VoteIcon({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 30h44v22a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2Z" />
      <path d="M24 30v-4h16v4" />
      <rect x="25" y="8" width="14" height="16" rx="1.5" />
      <path d="M28 16l3 3 5-6" />
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
