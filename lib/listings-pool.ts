import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Highest rent among currently-featurable listings (off-market and vetted)
 * — the same eligibility bar used to pick daily challenges and freeplay
 * rounds. Deliberately pool-wide rather than tied to whichever listing is
 * being played right now, so it can size the guess slider without leaking
 * anything about today's specific listing.
 */
export async function getMaxFeaturedRent(
  admin: ReturnType<typeof createAdminClient>
): Promise<number | null> {
  const { data } = await admin
    .from("listings")
    .select("actual_rent")
    .eq("is_off_market", true)
    .eq("review_status", "ready")
    .order("actual_rent", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.actual_rent ?? null;
}
