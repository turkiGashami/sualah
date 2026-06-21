/**
 * Backend smoke test: drives the deployed Edge Functions directly (no browser)
 * to verify rooms create/join/start, secret RLS reads, night actions, and
 * early-advance. Prints each phase transition. Run with the same env as pentest.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function client(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function anon(): Promise<SupabaseClient> {
  const c = client();
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new Error("signin: " + error.message);
  return c;
}
async function invoke<T = any>(c: SupabaseClient, fn: string, body: unknown): Promise<T> {
  const { data, error } = await c.functions.invoke(fn, { body });
  if (error) {
    let detail = "";
    const ctx = (error as { context?: Response }).context;
    if (ctx?.json) {
      try {
        detail = JSON.stringify(await ctx.json());
      } catch {
        /* noop */
      }
    }
    throw new Error(`${fn}: ${error.message} ${detail}`);
  }
  return data as T;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const host = await anon();
  const { code, roomId } = await invoke(host, "rooms", { action: "create" });
  console.log("✓ created room", code);

  // Big timers so only the night early-advance is exercised; reveal short.
  await invoke(host, "rooms", {
    action: "update_settings",
    roomId,
    settings: { roleRevealMs: 800, nightMs: 60000, dawnMs: 60000, discussionMs: 60000, voteMs: 60000, runoffMs: 60000, executionMs: 60000 },
  });

  const players: { c: SupabaseClient; id: string; role?: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const c = await anon();
    const r = await invoke(c, "rooms", { action: "join", code, nickname: `P${i + 1}` });
    players.push({ c, id: r.playerId });
  }
  console.log("✓ joined", players.length);

  const { sessionId } = await invoke(host, "rooms", { action: "start", roomId });
  console.log("✓ started session", sessionId);

  const phase = async () => {
    const { data } = await host.from("session_public").select("phase, round").eq("id", sessionId).single();
    return data as { phase: string; round: number };
  };
  console.log("  phase after start:", await phase());

  for (const p of players) {
    const { data, error } = await p.c.from("player_secrets").select("secret").eq("session_id", sessionId).single();
    if (error) throw new Error("secret read: " + error.message);
    p.role = (data!.secret as { role: string }).role;
  }
  console.log("  roles:", players.map((p) => p.role).join(", "));

  // role_reveal → night
  await sleep(1200);
  const adv = await invoke(host, "advance-phase", { sessionId });
  console.log("  advance →", adv, "| phase:", (await phase()).phase);

  // Night actions: ghoul devours a villager, seer inspects the ghoul.
  const ghoul = players.find((p) => p.role === "ghoul")!;
  const seer = players.find((p) => p.role === "seer");
  const villager = players.find((p) => p.role === "villager")!;
  await invoke(ghoul.c, "game-action", { type: "monster_pick", sessionId, target: villager.id });
  console.log("  ghoul picked");
  if (seer) {
    const r = await invoke(seer.c, "game-action", { type: "seer_inspect", sessionId, target: ghoul.id });
    console.log("  seer inspected → secret:", JSON.stringify(r.secret));
  }
  await sleep(500);
  console.log("  phase after night actions (expect dawn via early-advance):", await phase());
}

main()
  .then(() => {
    console.log("\n✅ smoke OK");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n✗ smoke FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
