import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runExrSync } from "@/lib/exr/sync";

// Scraping many pages + detail pages is slow; give it the max the plan allows.
export const maxDuration = 60;

const MAX_ENRICH_PER_RUN = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await runExrSync(admin, MAX_ENRICH_PER_RUN);
  if ("empty" in result) {
    return NextResponse.json(
      { ok: false, message: "Scrape returned no listings (site markup may have changed)" },
      { status: 200 }
    );
  }
  return NextResponse.json({ ok: true, ...result });
}
