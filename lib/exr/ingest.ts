import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExrListingRaw } from "@/lib/exr/scraper";
import { deriveTransit, KNOWN_NEIGHBORHOODS } from "@/lib/transit";

const KNOWN = new Set(KNOWN_NEIGHBORHOODS.map((n) => n.toLowerCase()));
const ELIGIBLE_BOROUGHS = new Set(["brooklyn", "manhattan"]);

export interface IngestResult {
  scraped: number;
  inserted: number;
  updated: number;
  markedOffMarket: number;
  skipped: number;
}

// We feature Brooklyn + Manhattan (the neighborhoods we have clue/transit
// data for). Other boroughs are scraped-but-skipped for now.
function isEligible(raw: ExrListingRaw): boolean {
  if (raw.borough && ELIGIBLE_BOROUGHS.has(raw.borough.toLowerCase())) return true;
  if (raw.neighborhood && KNOWN.has(raw.neighborhood.trim().toLowerCase())) return true;
  return false;
}

/** A scraped listing is usable only if it has the fields a puzzle needs. */
function isComplete(raw: ExrListingRaw): boolean {
  return (
    !!raw.neighborhood &&
    raw.beds !== null &&
    raw.baths !== null &&
    raw.rent !== null &&
    raw.rent > 0
  );
}

function toInsertRow(raw: ExrListingRaw) {
  return {
    neighborhood: raw.neighborhood!.trim(),
    city: raw.borough?.trim() || "Brooklyn",
    beds: raw.beds!,
    // Half baths are preserved — the column is numeric(3,1). Snap to the
    // nearest 0.5 so odd scraped values (1.25) land on a real bath count.
    baths: Math.round(raw.baths! * 2) / 2,
    sqft: null,
    amenities: [],
    transit: deriveTransit(raw.neighborhood!.trim()),
    nearby: null,
    actual_rent: raw.rent!,
    photos: raw.photos, // EXR CDN URLs (hybrid); re-host at vet time if desired
    address: raw.address || null,
    source: "exr" as const,
    review_status: "draft" as const,
    is_off_market: false,
    status: "active" as const,
    exr_listing_url: raw.exr_listing_url,
  };
}

/**
 * Reconcile a fresh scrape against the DB:
 *  - insert new listings as off-market=false drafts,
 *  - refresh rent/photos for existing (non-used) ones and mark them still
 *    on-market,
 *  - flip any previously-seen EXR listing that has now DISAPPEARED from the
 *    site to is_off_market=true (it leased) — this is what makes it safe to
 *    feature, since we never publish a live asking price.
 */
export async function ingestScrapedListings(
  admin: SupabaseClient,
  scraped: ExrListingRaw[],
  seenUrls: string[]
): Promise<IngestResult> {
  const usable = scraped.filter((r) => isEligible(r) && isComplete(r));
  const skipped = scraped.length - usable.length;
  // Every URL the site showed this run — used for conservative off-market
  // detection (a listing is only "gone" when absent from the whole site).
  const seen = new Set(seenUrls);

  const { data: existingRows } = await admin
    .from("listings")
    .select("id, exr_listing_url, status")
    .eq("source", "exr");

  const existing = new Map<string, { id: string; status: string }>();
  for (const row of existingRows ?? []) {
    if (row.exr_listing_url) existing.set(row.exr_listing_url, { id: row.id, status: row.status });
  }

  const toInsert: ReturnType<typeof toInsertRow>[] = [];
  let updated = 0;

  for (const raw of usable) {
    const found = existing.get(raw.exr_listing_url);
    if (!found) {
      toInsert.push(toInsertRow(raw));
    } else if (found.status !== "used") {
      // Refresh volatile fields; never wipe existing photos with an empty
      // set, and never touch a human's review_status.
      const update: Record<string, unknown> = { actual_rent: raw.rent!, is_off_market: false };
      if (raw.photos.length > 0) update.photos = raw.photos;
      if (raw.address) update.address = raw.address;
      await admin.from("listings").update(update).eq("id", found.id);
      updated++;
    }
  }

  let inserted = 0;
  if (toInsert.length > 0) {
    const { data, error } = await admin.from("listings").insert(toInsert).select("id");
    if (!error && data) inserted = data.length;
  }

  // Absence => off-market. Any previously-seen EXR listing not present
  // ANYWHERE on the site this run (and not already used) has left the site:
  // mark it off-market/featurable.
  const absentIds = (existingRows ?? [])
    .filter((row) => row.exr_listing_url && !seen.has(row.exr_listing_url) && row.status !== "used")
    .map((row) => row.id);

  let markedOffMarket = 0;
  if (absentIds.length > 0) {
    const { data } = await admin
      .from("listings")
      .update({ is_off_market: true })
      .in("id", absentIds)
      .eq("is_off_market", false)
      .select("id");
    markedOffMarket = data?.length ?? 0;
  }

  return { scraped: scraped.length, inserted, updated, markedOffMarket, skipped };
}
