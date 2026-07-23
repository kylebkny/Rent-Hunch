import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeListingPhotos } from "@/lib/exr/scraper";

export const maxDuration = 60;

// How many listings to backfill photos for per click (fits the time budget).
const BATCH = 40;

/** Backfill photos for EXR listings that have none — no index scrape. */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("listings")
    .select("id, exr_listing_url, photos")
    .eq("source", "exr")
    .not("exr_listing_url", "is", null);

  const photoLess = (rows ?? []).filter(
    (r) => Array.isArray(r.photos) && r.photos.length === 0 && r.exr_listing_url
  );
  const totalRemaining = photoLess.length;
  const batch = photoLess.slice(0, BATCH);

  if (batch.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, remaining: 0 });
  }

  const urlToId = new Map(batch.map((r) => [r.exr_listing_url as string, r.id]));
  const results = await scrapeListingPhotos(batch.map((r) => r.exr_listing_url as string));

  let updated = 0;
  for (const { url, photos } of results) {
    if (photos.length === 0) continue;
    const id = urlToId.get(url);
    if (!id) continue;
    await admin.from("listings").update({ photos }).eq("id", id);
    updated++;
  }

  return NextResponse.json({ ok: true, updated, remaining: totalRemaining - updated });
}
