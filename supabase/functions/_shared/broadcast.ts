// Realtime broadcast over HTTP. We push explicit PUBLIC snapshots to the
// room:{code} channel (§6) rather than using Postgres CDC, which would ship the
// full row (including game_sessions.state) and leak secrets.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface BroadcastMsg {
  event: string;
  payload: unknown;
}

export async function broadcast(code: string, messages: BroadcastMsg[]): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ topic: `room:${code}`, event: m.event, payload: m.payload })),
    }),
  });
  if (!res.ok) {
    console.error(JSON.stringify({ at: "broadcast", code, status: res.status }));
  }
}
