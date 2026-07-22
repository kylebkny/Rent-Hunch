import "server-only";
import { createClient as createAuthClient } from "@/lib/supabase/server";

/**
 * Admin access = a real Supabase email/password user whose email is in the
 * ADMIN_EMAILS allowlist (comma-separated). Sturdier than a shared password
 * and scales to multiple admins later without a schema change.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminEmail(): Promise<string | null> {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase();
  if (!email) return null;
  // Anonymous users have no email, so they can never be admins.
  if (!adminEmails().includes(email)) return null;
  return email;
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminEmail()) !== null;
}
