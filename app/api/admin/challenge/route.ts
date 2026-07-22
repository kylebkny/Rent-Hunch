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

  let body: { listing_id?: string };
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

  const { data: existing } = await admin
    .from("daily_challenges")
    .select("id")
    .eq("challenge_date", challengeDate)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Today already has a challenge" },
      { status: 409 }
    );
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
