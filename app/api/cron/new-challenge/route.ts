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

  // Only vetted, active listings are eligible. Manual entries are 'ready'
  // immediately; scraped ones must be promoted from 'draft' first.
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id")
    .eq("status", "active")
    .eq("review_status", "ready")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (listingError || !listing) {
    return NextResponse.json(
      { error: "No ready listings left to feature" },
      { status: 500 }
    );
  }

  const { data: challenge, error: insertError } = await admin
    .from("daily_challenges")
    .insert({ listing_id: listing.id, challenge_date: challengeDate })
    .select("id")
    .single();

  if (insertError || !challenge) {
    return NextResponse.json({ error: "Could not create today's challenge" }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("listings")
    .update({ status: "used" })
    .eq("id", listing.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Challenge created but failed to flip listing to used", challenge_id: challenge.id },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, challenge_id: challenge.id, listing_id: listing.id });
}
