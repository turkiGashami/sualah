import { supabase } from "./supabase";

/**
 * Ensure an auth session exists. v1 uses anonymous auth for both hosts and
 * players (email/Google for hosts can be layered on later). The session is the
 * rejoin mechanism (§9) — the one allowed use of persistent local storage.
 */
export async function ensureAnon(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error(error?.message ?? "auth_failed");
  return data.user.id;
}
