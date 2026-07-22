import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth-only server client, bound to the anon key + the request's cookies.
 * Use this to identify the caller (supabase.auth.getUser()) in Route
 * Handlers. It respects RLS, so it must never be used to read/write the
 * game tables directly — use lib/supabase/admin.ts for that, scoped to the
 * user id this client verifies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render; middleware refreshes
            // the session cookie on the next request instead.
          }
        },
      },
    }
  );
}
