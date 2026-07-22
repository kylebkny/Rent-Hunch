import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — this is the ONLY client
 * allowed to touch listings/daily_challenges/guesses/game_state/profiles,
 * since those tables have RLS enabled with zero client-facing policies.
 *
 * NEVER import this file from a "use client" component or expose
 * SUPABASE_SERVICE_ROLE_KEY to the browser. The "server-only" import above
 * makes any such import fail the build.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
