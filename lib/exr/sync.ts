import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scrapeAllExrListings } from "@/lib/exr/scraper";
import { ingestScrapedListings, type IngestResult } from "@/lib/exr/ingest";

/**
 * Run one EXR sync: scrape the site, skip listings we already have, and
 * reconcile into the DB. Shared by the weekly cron and the admin "Sync now"
 * button. Returns { empty: true } when the scrape found nothing.
 */
export async function runExrSync(
  admin: SupabaseClient,
  maxEnrich = 30
): Promise<IngestResult | { empty: true }> {
  // Only skip listings we've already FULLY enriched (they have photos).
  // Photo-less ones get re-fetched on later runs so photos backfill over time.
  const { data: known } = await admin
    .from("listings")
    .select("exr_listing_url, photos")
    .eq("source", "exr");
  const alreadyEnriched = new Set(
    (known ?? [])
      .filter((r) => Array.isArray(r.photos) && r.photos.length > 0)
      .map((r) => r.exr_listing_url)
      .filter(Boolean) as string[]
  );

  const { listings, seenUrls } = await scrapeAllExrListings(alreadyEnriched, maxEnrich);
  if (seenUrls.length === 0) return { empty: true };

  return ingestScrapedListings(admin, listings, seenUrls);
}
