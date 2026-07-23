import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const challengeDate = todayET();

  const { data: existing } = await admin
    .from("daily_challenges")
    .select("id")
    .eq("challenge_date", challengeDate)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, message: "Already rolled over", challenge_id: existing.id });
  }

  // A listing pre-scheduled for today (via the admin schedule) wins over the
  // auto-pick. It's already reserved (status='used') when scheduled.
  const { data: scheduled } = await admin
    .from("scheduled_challenges")
    .select("listing_id")
    .eq("challenge_date", challengeDate)
    .maybeSingle();

  let listingId = scheduled?.listing_id ?? null;

  if (!listingId) {
    // Otherwise auto-pick the oldest vetted, off-market, active listing.
    // is_off_market must be true so we never publish the asking price of a
    // still-on-market EXR unit. Manual listings default to off_market=true.
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id")
      .eq("status", "active")
      .eq("review_status", "ready")
      .eq("is_off_market", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json({ error: "No ready listings left to feature" }, { status: 500 });
    }
    listingId = listing.id;
  }

  const { data: challenge, error: insertError } = await admin
    .from("daily_challenges")
    .insert({ listing_id: listingId, challenge_date: challengeDate })
    .select("id")
    .single();

  if (insertError || !challenge) {
    return NextResponse.json({ error: "Could not create today's challenge" }, { status: 500 });
  }

  await admin.from("listings").update({ status: "used" }).eq("id", listingId);
  if (scheduled) {
    await admin.from("scheduled_challenges").delete().eq("challenge_date", challengeDate);
  }

  return NextResponse.json({ ok: true, challenge_id: challenge.id, listing_id: listingId });
}
