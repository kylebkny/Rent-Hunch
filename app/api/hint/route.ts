import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jitterPoint, buildRadiusMapUrl } from "@/lib/radius-map";
import type { HintReveal } from "@/lib/types";

interface HintBody {
  challenge_id?: string;
}

/**
 * Spend the puzzle's one hint token. Reveals year_built (if PLUTO found
 * one) and a radius map centered on a *jittered* point — never the
 * listing's real lat/lng, and never sent to the client. The jitter is
 * computed once and persisted in game_state.hint: re-fetching after
 * spending returns the same reveal rather than generating a fresh (and
 * thus triangulatable) circle each time.
 */
export async function POST(request: Request) {
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: HintBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { challenge_id } = body;
  if (!challenge_id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existingGuess } = await admin
    .from("guesses")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challenge_id)
    .maybeSingle();
  if (existingGuess) {
    return NextResponse.json({ error: "This puzzle is already finished" }, { status: 409 });
  }

  const { data: state } = await admin
    .from("game_state")
    .select("hint")
    .eq("user_id", user.id)
    .eq("challenge_id", challenge_id)
    .maybeSingle();

  // Already spent — return the same reveal rather than regenerating one.
  if (state?.hint) {
    return NextResponse.json({ ok: true, reveal: state.hint as HintReveal });
  }

  const { data: challenge, error: challengeError } = await admin
    .from("daily_challenges")
    .select("id, listings(lat, lng, year_built)")
    .eq("id", challenge_id)
    .maybeSingle();
  if (challengeError || !challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  const listing = Array.isArray(challenge.listings) ? challenge.listings[0] : challenge.listings;
  if (!listing) {
    return NextResponse.json({ error: "Challenge is missing its listing" }, { status: 500 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  let mapUrl: string | null = null;
  if (apiKey && typeof listing.lat === "number" && typeof listing.lng === "number") {
    const jittered = jitterPoint({ lat: listing.lat, lng: listing.lng });
    mapUrl = buildRadiusMapUrl(jittered, { apiKey });
  }

  const reveal: HintReveal = { year_built: listing.year_built ?? null, map_url: mapUrl };

  await admin.from("game_state").upsert(
    { user_id: user.id, challenge_id, hint: reveal, updated_at: new Date().toISOString() },
    { onConflict: "user_id,challenge_id" }
  );

  return NextResponse.json({ ok: true, reveal });
}
