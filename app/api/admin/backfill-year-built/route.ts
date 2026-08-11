import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupYearBuilt } from "@/lib/pluto";
import { mapWithConcurrency } from "@/lib/concurrency";

const CONCURRENCY = 5;

/**
 * Backfill year_built (NYC PLUTO enrichment, lib/pluto.ts) onto listings
 * that predate this feature — manual, EXR, and StreetEasy-sourced alike,
 * since PLUTO is keyed by address/BBL, not by listing source. Listings
 * that already have a year_built are left untouched.
 */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: listings, error } = await admin
    .from("listings")
    .select("id, address, lat, lng")
    .is("year_built", null);
  if (error) {
    return NextResponse.json({ error: "Could not read listings" }, { status: 500 });
  }

  const candidates = (listings ?? []).filter((l) => l.address || (l.lat != null && l.lng != null));

  const results = await mapWithConcurrency(candidates, CONCURRENCY, async (l) => {
    const yearBuilt = await lookupYearBuilt({ address: l.address, lat: l.lat, lng: l.lng });
    if (yearBuilt == null) return false;
    const { error: updateError } = await admin
      .from("listings")
      .update({ year_built: yearBuilt })
      .eq("id", l.id);
    return !updateError;
  });

  return NextResponse.json({
    ok: true,
    filled: results.filter(Boolean).length,
    scanned: listings?.length ?? 0,
  });
}
