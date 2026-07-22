import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeScore } from "@/lib/scoring";
import type { GuessResponse } from "@/lib/types";

interface GuessBody {
  challenge_id?: string;
  guess_amount?: number;
}

export async function POST(request: Request) {
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: GuessBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { challenge_id, guess_amount } = body;
  if (!challenge_id || typeof guess_amount !== "number" || !Number.isFinite(guess_amount) || guess_amount <= 0) {
    return NextResponse.json({ error: "Invalid guess" }, { status: 400 });
  }

  const admin = createAdminClient();

  // One attempt per user per day — the unique constraint is the real
  // guard, this is just a friendlier pre-check.
  const { data: existing } = await admin
    .from("guesses")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challenge_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You've already played today's challenge" },
      { status: 409 }
    );
  }

  const { data: challenge, error: challengeError } = await admin
    .from("daily_challenges")
    .select("id, edition, challenge_date, listings(actual_rent)")
    .eq("id", challenge_id)
    .maybeSingle();

  if (challengeError || !challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  const listing = Array.isArray(challenge.listings)
    ? challenge.listings[0]
    : challenge.listings;

  if (!listing) {
    return NextResponse.json({ error: "Challenge is missing its listing" }, { status: 500 });
  }

  const actualRent = listing.actual_rent;

  // Trust the server's record of the player's progress, not the client's
  // claimed round — that's what determines the score ceiling.
  const { data: state } = await admin
    .from("game_state")
    .select("current_round")
    .eq("user_id", user.id)
    .eq("challenge_id", challenge_id)
    .maybeSingle();
  const round = state?.current_round ?? 0;

  const score = computeScore(round, guess_amount, actualRent);

  const { error: insertError } = await admin.from("guesses").insert({
    user_id: user.id,
    challenge_id,
    round,
    guess_amount,
    score,
  });

  if (insertError) {
    // Unique violation means a duplicate slipped in between the check and
    // the insert (race) — treat it the same as the pre-check above.
    const status = insertError.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: "Could not record guess" }, { status });
  }

  await updateStreakAndScore(admin, user.id, challenge.challenge_date, score);

  const { data: crowdRows } = await admin
    .from("guesses")
    .select("guess_amount")
    .eq("challenge_id", challenge_id);

  const crowdAvg = crowdRows && crowdRows.length > 0
    ? Math.round(crowdRows.reduce((sum, row) => sum + row.guess_amount, 0) / crowdRows.length)
    : guess_amount;

  const body_: GuessResponse = {
    score,
    actual_rent: actualRent,
    crowd_avg: crowdAvg,
    edition: challenge.edition,
    round,
  };

  return NextResponse.json(body_);
}

async function updateStreakAndScore(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  challengeDate: string,
  score: number
) {
  const { data: profile } = await admin
    .from("profiles")
    .select("streak_count, longest_streak, total_score")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: previousChallengeDates } = await admin
    .from("guesses")
    .select("challenge_id, daily_challenges!inner(challenge_date)")
    .eq("user_id", userId)
    .lt("daily_challenges.challenge_date", challengeDate)
    .order("challenge_date", { foreignTable: "daily_challenges", ascending: false })
    .limit(1);

  const mostRecentPrevDate = Array.isArray(previousChallengeDates) && previousChallengeDates.length > 0
    ? (Array.isArray(previousChallengeDates[0].daily_challenges)
        ? previousChallengeDates[0].daily_challenges[0]?.challenge_date
        : (previousChallengeDates[0].daily_challenges as { challenge_date: string })?.challenge_date)
    : null;

  const isConsecutive = mostRecentPrevDate
    ? isNextCalendarDay(mostRecentPrevDate, challengeDate)
    : false;

  const newStreak = isConsecutive ? (profile?.streak_count ?? 0) + 1 : 1;
  const newLongest = Math.max(newStreak, profile?.longest_streak ?? 0);
  const newTotal = (profile?.total_score ?? 0) + score;

  await admin.from("profiles").upsert(
    {
      user_id: userId,
      streak_count: newStreak,
      longest_streak: newLongest,
      total_score: newTotal,
    },
    { onConflict: "user_id" }
  );
}

function isNextCalendarDay(prevDate: string, currentDate: string): boolean {
  const prev = new Date(prevDate + "T00:00:00Z");
  const current = new Date(currentDate + "T00:00:00Z");
  const diffDays = Math.round((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}
