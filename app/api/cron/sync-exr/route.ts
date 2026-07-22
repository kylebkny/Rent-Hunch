import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeExrRentals } from "@/lib/exr/scraper";
import { ingestScrapedListings } from "@/lib/exr/ingest";

// Scraping many pages + detail pages is slow; give it the max the plan allows.
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scraped = await scrapeExrRentals();
  if (scraped.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Scrape returned no listings (site markup may have changed)" },
      { status: 200 }
    );
  }

  const admin = createAdminClient();
  const result = await ingestScrapedListings(admin, scraped);

  return NextResponse.json({ ok: true, ...result });
}
