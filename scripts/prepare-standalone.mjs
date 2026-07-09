// Copy static assets into the Next standalone output so its server.js can
// serve them directly (node .next/standalone/apps/web/server.js). Runs after
// `next build` as part of the root build script; idempotent.
import { cpSync, rmSync, existsSync } from "node:fs";

const staticSrc = "apps/web/.next/static";
const staticDst = "apps/web/.next/standalone/apps/web/.next/static";

if (!existsSync(staticSrc)) {
  console.error("prepare-standalone: missing", staticSrc, "— run next build first");
  process.exit(1);
}
rmSync(staticDst, { recursive: true, force: true });
cpSync(staticSrc, staticDst, { recursive: true });
console.log("✓ standalone prepared (static assets copied)");
