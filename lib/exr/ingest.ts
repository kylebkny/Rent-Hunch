import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExrListingRaw } from "@/lib/exr/scraper";
import { deriveTransit, KNOWN_NEIGHBORHOODS } from "@/lib/transit";

const KNOWN_BK = new Set(KNOWN_NEIGHBORHOODS.map((n) => n.toLowerCase()));

export interface IngestResult {
  scraped: number;
  inserted: number;
  updated: number;
  markedOffMarket: number;
  skipped: number;
}

function isBrooklyn(raw: ExrListingRaw): boolean {
  if (raw.borough && raw.borough.toLowerCase() === "brooklyn") return true;
  if (raw.neighborhood && KNOWN_BK.has(raw.neighborhood.trim().toLowerCase())) return true;
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
    city: "Brooklyn",
    beds: raw.beds!,
    baths: Math.round(raw.baths!), // schema stores baths as int
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
  const usable = scraped.filter((r) => isBrooklyn(r) && isComplete(r));
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
