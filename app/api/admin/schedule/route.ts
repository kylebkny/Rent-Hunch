import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBedsBaths } from "@/lib/listing-options";

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  const today = todayET();

  const { data: scheduled } = await admin
    .from("scheduled_challenges")
    .select("challenge_date, listing_id, listings(neighborhood, beds, baths, actual_rent)")
    .gte("challenge_date", today)
    .order("challenge_date", { ascending: true });

  const { data: todayChallenge } = await admin
    .from("daily_challenges")
    .select("id")
    .eq("challenge_date", today)
    .maybeSingle();

  // Featurable listings not yet scheduled/used — the pool we can auto-fill from.
  const { count: poolCount } = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("review_status", "ready")
    .eq("is_off_market", true);

  const scheduledCount = scheduled?.length ?? 0;
  // Days of content on hand: today (if set) + future scheduled + the ready pool.
  const runwayDays = (todayChallenge ? 1 : 0) + scheduledCount + (poolCount ?? 0);

  return NextResponse.json({
    today,
    has_today: !!todayChallenge,
    pool_count: poolCount ?? 0,
    runway_days: runwayDays,
    scheduled: (scheduled ?? []).map((s) => {
      const l = Array.isArray(s.listings) ? s.listings[0] : s.listings;
      return {
        challenge_date: s.challenge_date,
        listing_id: s.listing_id,
        label: l ? `${l.neighborhood} · ${formatBedsBaths(l.beds, l.baths)} · $${l.actual_rent.toLocaleString()}` : "—",
      };
    }),
  });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { listing_id?: string; challenge_date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { listing_id, challenge_date } = body;
  if (!listing_id || !challenge_date || !/^\d{4}-\d{2}-\d{2}$/.test(challenge_date)) {
    return NextResponse.json({ error: "Missing listing or date" }, { status: 400 });
  }
  if (challenge_date <= todayET()) {
    return NextResponse.json(
      { error: "Pick a future date (use “Set as today” for today)" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("is_off_market")
    .eq("id", listing_id)
    .maybeSingle();
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (!listing.is_off_market) {
    return NextResponse.json({ error: "Listing is still on-market" }, { status: 409 });
  }

  const { data: existingChallenge } = await admin
    .from("daily_challenges")
    .select("id")
    .eq("challenge_date", challenge_date)
    .maybeSingle();
  if (existingChallenge) {
    return NextResponse.json({ error: "That date already has a challenge" }, { status: 409 });
  }

  const { error } = await admin
    .from("scheduled_challenges")
    .insert({ challenge_date, listing_id });
  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    const msg = status === 409 ? "That date is already scheduled" : "Could not schedule";
    return NextResponse.json({ error: msg }, { status });
  }

  // Reserve the listing so it isn't double-booked or auto-picked.
  await admin.from("listings").update({ status: "used" }).eq("id", listing_id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Missing date" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("scheduled_challenges")
    .select("listing_id")
    .eq("challenge_date", date)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "Not scheduled" }, { status: 404 });
  }

  await admin.from("scheduled_challenges").delete().eq("challenge_date", date);
  // Return the listing to the eligible pool.
  await admin.from("listings").update({ status: "active" }).eq("id", row.listing_id);

  return NextResponse.json({ ok: true });
}
