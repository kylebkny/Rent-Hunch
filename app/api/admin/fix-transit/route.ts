import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { repairTransitClue } from "@/lib/subway-lines";
import { deriveTransit } from "@/lib/transit";

/**
 * Backfill train lines onto clues saved before the station index existed.
 * Those read "Bedford Av · 4 min walk" — a station with no lines, so the game
 * rendered plain text instead of line bullets. Listings that already name a
 * line, or whose station we don't recognize, are left untouched.
 */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: listings, error } = await admin
    .from("listings")
    .select("id, neighborhood, transit");
  if (error) {
    return NextResponse.json({ error: "Could not read listings" }, { status: 500 });
  }

  let fixed = 0;
  for (const l of listings ?? []) {
    const repaired = repairTransitClue(l.transit ?? "", deriveTransit(l.neighborhood ?? ""));
    if (!repaired || repaired === l.transit) continue;
    const { error: updateError } = await admin
      .from("listings")
      .update({ transit: repaired })
      .eq("id", l.id);
    if (!updateError) fixed++;
  }

  return NextResponse.json({ ok: true, fixed, scanned: listings?.length ?? 0 });
}
