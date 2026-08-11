import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMaxFeaturedRent } from "@/lib/listings-pool";
import { computeSliderMax } from "@/lib/guess-slider";
import type { HintReveal, TodayChallengeResponse } from "@/lib/types";

function todayET(): string {
  // en-CA gives YYYY-MM-DD, matching Postgres `date` literal format.
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export async function GET() {
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const challengeDate = todayET();

  const { data: challenge, error: challengeError } = await admin
    .from("daily_challenges")
    .select("id, edition, challenge_date, listings(neighborhood, city, beds, baths, sqft, amenities, transit, nearby, photos)")
    .eq("challenge_date", challengeDate)
    .maybeSingle();

  if (challengeError || !challenge) {
    return NextResponse.json(
      { error: "No challenge available for today" },
      { status: 404 }
    );
  }

  const listing = Array.isArray(challenge.listings)
    ? challenge.listings[0]
    : challenge.listings;

  if (!listing) {
    return NextResponse.json(
      { error: "Challenge is missing its listing" },
      { status: 500 }
    );
  }

  const [{ data: existingGuess }, { data: state }, maxFeaturedRent] = await Promise.all([
    admin
      .from("guesses")
      .select("round, guess_amount, score")
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id)
      .maybeSingle(),
    admin
      .from("game_state")
      .select("current_round, guesses, hint")
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id)
      .maybeSingle(),
    getMaxFeaturedRent(admin),
  ]);

  const body: TodayChallengeResponse = {
    challenge_id: challenge.id,
    edition: challenge.edition,
    challenge_date: challenge.challenge_date,
    clues: {
      neighborhood: listing.neighborhood,
      city: listing.city,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft ?? null,
      amenities: listing.amenities ?? [],
      transit: listing.transit,
      nearby: listing.nearby ?? null,
    },
    photos: Array.isArray(listing.photos) ? (listing.photos as string[]) : [],
    slider_max: computeSliderMax(maxFeaturedRent),
    guess: existingGuess
      ? {
          round: existingGuess.round,
          guess_amount: existingGuess.guess_amount,
          score: existingGuess.score,
        }
      : null,
    game_state: state
      ? {
          current_round: state.current_round,
          guesses: Array.isArray(state.guesses) ? state.guesses : [],
        }
      : null,
    hint: (state?.hint as HintReveal | null) ?? null,
  };

  return NextResponse.json(body);
}
