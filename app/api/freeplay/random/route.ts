import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMaxFeaturedRent } from "@/lib/listings-pool";
import { computeSliderMax } from "@/lib/guess-slider";
import type { ListingClues } from "@/lib/types";

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/**
 * Serves a random listing for freeplay — no streak/leaderboard, just for fun.
 * Only off-market, vetted listings are eligible (never leaks a live asking
 * price), and today's daily challenge is excluded so freeplay can't spoil it.
 * Never returns actual_rent.
 */
export async function GET() {
  const admin = createAdminClient();

  const { data: todayChallenge } = await admin
    .from("daily_challenges")
    .select("listing_id")
    .eq("challenge_date", todayET())
    .maybeSingle();

  let idQuery = admin
    .from("listings")
    .select("id")
    .eq("is_off_market", true)
    .eq("review_status", "ready");
  if (todayChallenge?.listing_id) {
    idQuery = idQuery.neq("id", todayChallenge.listing_id);
  }

  const [{ data: ids }, maxFeaturedRent] = await Promise.all([idQuery, getMaxFeaturedRent(admin)]);
  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "No listings available for freeplay yet" }, { status: 404 });
  }

  const pick = ids[Math.floor(Math.random() * ids.length)].id;

  const { data: listing, error } = await admin
    .from("listings")
    .select("id, neighborhood, city, beds, baths, sqft, amenities, transit, nearby, photos")
    .eq("id", pick)
    .single();

  if (error || !listing) {
    return NextResponse.json({ error: "Could not load listing" }, { status: 500 });
  }

  const clues: ListingClues = {
    neighborhood: listing.neighborhood,
    city: listing.city,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft ?? null,
    amenities: listing.amenities ?? [],
    transit: listing.transit,
    nearby: listing.nearby ?? null,
  };

  return NextResponse.json({
    listing_id: listing.id,
    clues,
    photos: Array.isArray(listing.photos) ? listing.photos : [],
    slider_max: computeSliderMax(maxFeaturedRent),
  });
}
