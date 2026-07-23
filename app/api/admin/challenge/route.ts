import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/**
 * Manually feature a listing as today's challenge (bypasses waiting for the
 * cron). Useful to get the game playable on demand.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { listing_id?: string; replace?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.listing_id) {
    return NextResponse.json({ error: "Missing listing_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const challengeDate = todayET();

  // Safety: never feature a still-on-market listing (would leak a live rent).
  const { data: listing } = await admin
    .from("listings")
    .select("is_off_market")
    .eq("id", body.listing_id)
    .maybeSingle();
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (!listing.is_off_market) {
    return NextResponse.json(
      { error: "Listing is still on-market — mark it off-market before featuring" },
      { status: 409 }
    );
  }

  const { data: existing } = await admin
    .from("daily_challenges")
    .select("id, listing_id")
    .eq("challenge_date", challengeDate)
    .maybeSingle();

  if (existing) {
    if (!body.replace) {
      return NextResponse.json(
        { error: "Today already has a challenge", replaceable: true },
        { status: 409 }
      );
    }
    // Replace today's challenge: clear its plays, drop the row, and return
    // the previously-featured listing to the pool.
    await admin.from("guesses").delete().eq("challenge_id", existing.id);
    await admin.from("game_state").delete().eq("challenge_id", existing.id);
    await admin.from("daily_challenges").delete().eq("id", existing.id);
    if (existing.listing_id && existing.listing_id !== body.listing_id) {
      await admin.from("listings").update({ status: "active" }).eq("id", existing.listing_id);
    }
  }

  const { data: challenge, error } = await admin
    .from("daily_challenges")
    .insert({ listing_id: body.listing_id, challenge_date: challengeDate })
    .select("id, edition")
    .single();

  if (error || !challenge) {
    return NextResponse.json({ error: "Could not create challenge" }, { status: 500 });
  }

  await admin.from("listings").update({ status: "used" }).eq("id", body.listing_id);

  return NextResponse.json({ ok: true, challenge_id: challenge.id, edition: challenge.edition });
}
