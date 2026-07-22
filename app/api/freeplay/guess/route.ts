import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeScore, hintFor, MAX_GUESSES } from "@/lib/scoring";

interface Body {
  listing_id?: string;
  guess_amount?: number;
  prior_guesses?: number[];
  final?: boolean;
}

/**
 * Stateless freeplay scoring. Returns a hint for non-final guesses and the
 * actual rent + score on the final one. Nothing is persisted. actual_rent
 * only appears in the final response.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { listing_id, guess_amount } = body;
  if (
    !listing_id ||
    typeof guess_amount !== "number" ||
    !Number.isFinite(guess_amount) ||
    guess_amount <= 0
  ) {
    return NextResponse.json({ error: "Invalid guess" }, { status: 400 });
  }
  const prior = Array.isArray(body.prior_guesses)
    ? body.prior_guesses.filter((n) => typeof n === "number" && Number.isFinite(n))
    : [];

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("actual_rent, is_off_market, review_status")
    .eq("id", listing_id)
    .maybeSingle();

  // Safety: only reveal rent for off-market, vetted listings.
  if (!listing || !listing.is_off_market || listing.review_status !== "ready") {
    return NextResponse.json({ error: "Listing not available" }, { status: 404 });
  }
  const actualRent = listing.actual_rent;

  const hint = hintFor(guess_amount, actualRent);
  const attempt = prior.length + 1;
  const isFinal = body.final === true || attempt >= MAX_GUESSES || hint.direction === "exact";

  if (!isFinal) {
    return NextResponse.json({ final: false, attempt, hint });
  }

  const all = [...prior, guess_amount];
  const bestGuess = all.reduce((best, g) =>
    Math.abs(g - actualRent) < Math.abs(best - actualRent) ? g : best,
    all[0]
  );
  const score = computeScore(bestGuess, actualRent, attempt);

  return NextResponse.json({
    final: true,
    attempt,
    hint,
    score,
    actual_rent: actualRent,
    best_guess: bestGuess,
    guesses_used: attempt,
  });
}
