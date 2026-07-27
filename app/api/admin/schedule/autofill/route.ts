import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** YYYY-MM-DD for `offset` days after `base` (base is a YYYY-MM-DD string). */
function addDays(base: string, offset: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

const MAX_FILL_DAYS = 30;

/**
 * Front-load the schedule: assign ready, off-market listings to the next N
 * empty upcoming dates so the daily rollover always has content on hand.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { days?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const days = Math.min(MAX_FILL_DAYS, Math.max(1, Math.floor(body.days ?? 14)));

  const admin = createAdminClient();
  const today = todayET();

  // The pool of featurable listings, oldest first (same criteria the cron uses).
  const { data: pool } = await admin
    .from("listings")
    .select("id")
    .eq("status", "active")
    .eq("review_status", "ready")
    .eq("is_off_market", true)
    .order("created_at", { ascending: true });

  const available = pool ?? [];
  if (available.length === 0) {
    return NextResponse.json({ ok: true, filled: 0, message: "No ready listings to schedule" });
  }

  // Dates already spoken for — today's live challenge and anything queued ahead.
  const { data: existingChallenges } = await admin
    .from("daily_challenges")
    .select("challenge_date")
    .gte("challenge_date", today);
  const { data: existingScheduled } = await admin
    .from("scheduled_challenges")
    .select("challenge_date")
    .gte("challenge_date", today);

  const taken = new Set<string>([
    ...(existingChallenges ?? []).map((r) => r.challenge_date),
    ...(existingScheduled ?? []).map((r) => r.challenge_date),
  ]);

  const rows: { challenge_date: string; listing_id: string }[] = [];
  const usedListingIds: string[] = [];
  let poolIdx = 0;

  // Walk forward from tomorrow, filling each empty date until we run out of
  // days to fill or listings to place.
  for (let offset = 1; rows.length < days && poolIdx < available.length; offset++) {
    // Guard against runaway loops (e.g. everything already taken far out).
    if (offset > days + taken.size + 1) break;
    const date = addDays(today, offset);
    if (taken.has(date)) continue;
    const listingId = available[poolIdx++].id;
    rows.push({ challenge_date: date, listing_id: listingId });
    usedListingIds.push(listingId);
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, filled: 0, message: "Upcoming dates already scheduled" });
  }

  const { error: insertError } = await admin.from("scheduled_challenges").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: "Could not schedule listings" }, { status: 500 });
  }

  // Reserve the listings so they aren't double-booked or auto-picked.
  await admin.from("listings").update({ status: "used" }).in("id", usedListingIds);

  return NextResponse.json({ ok: true, filled: rows.length });
}
