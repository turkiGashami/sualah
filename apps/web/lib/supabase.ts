import { createClient } from "@supabase/supabase-js";

// Placeholders keep `next build` working without env; real values come from
// NEXT_PUBLIC_* at runtime. The anon key is the ONLY Supabase key the browser
// ever sees — RLS + the pen-test guarantee it cannot read secrets.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-placeholder";

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});
