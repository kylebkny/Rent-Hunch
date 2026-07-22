import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeAllExrListings } from "@/lib/exr/scraper";
import { ingestScrapedListings } from "@/lib/exr/ingest";

// Scraping many pages + detail pages is slow; give it the max the plan allows.
export const maxDuration = 60;

// Cap new detail-page fetches per run so the job fits inside the function
// time limit; the rest are picked up on later runs (incremental backfill).
const MAX_ENRICH_PER_RUN = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Listings we already have full data for — skip re-fetching their pages.
  const { data: known } = await admin
    .from("listings")
    .select("exr_listing_url")
    .eq("source", "exr");
  const alreadyEnriched = new Set(
    (known ?? []).map((r) => r.exr_listing_url).filter(Boolean) as string[]
  );

  const { listings, seenUrls } = await scrapeAllExrListings(
    alreadyEnriched,
    MAX_ENRICH_PER_RUN
  );

  if (seenUrls.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Scrape returned no listings (site markup may have changed)" },
      { status: 200 }
    );
  }

  const result = await ingestScrapedListings(admin, listings, seenUrls);
  return NextResponse.json({ ok: true, ...result });
}
