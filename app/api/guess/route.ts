import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeScore, hintFor, MAX_GUESSES } from "@/lib/scoring";
import type { GuessAttempt, GuessResponse } from "@/lib/types";

interface GuessBody {
  challenge_id?: string;
  guess_amount?: number;
  final?: boolean;
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
  if (
    !challenge_id ||
    typeof guess_amount !== "number" ||
    !Number.isFinite(guess_amount) ||
    guess_amount <= 0
  ) {
    return NextResponse.json({ error: "Invalid guess" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Already finished today?
  const { data: existing } = await admin
    .from("guesses")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challenge_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "You've already played today's challenge" }, { status: 409 });
  }

  const { data: challenge, error: challengeError } = await admin
    .from("daily_challenges")
    .select("id, edition, challenge_date, listings(actual_rent)")
    .eq("id", challenge_id)
    .maybeSingle();
  if (challengeError || !challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  const listing = Array.isArray(challenge.listings) ? challenge.listings[0] : challenge.listings;
  if (!listing) {
    return NextResponse.json({ error: "Challenge is missing its listing" }, { status: 500 });
  }
  const actualRent = listing.actual_rent;

  // In-progress guesses so far.
  const { data: state } = await admin
    .from("game_state")
    .select("guesses")
    .eq("user_id", user.id)
    .eq("challenge_id", challenge_id)
    .maybeSingle();
  const prior: GuessAttempt[] = Array.isArray(state?.guesses) ? (state!.guesses as GuessAttempt[]) : [];

  const hint = hintFor(guess_amount, actualRent);
  const attempt: GuessAttempt = { amount: guess_amount, direction: hint.direction, band: hint.band };
  const guesses = [...prior, attempt];
  const guessesUsed = guesses.length;
  const isFinal = body.final === true || guessesUsed >= MAX_GUESSES || hint.direction === "exact";

  if (!isFinal) {
    const round = Math.min(guessesUsed, 3);
    await admin.from("game_state").upsert(
      { user_id: user.id, challenge_id, current_round: round, guesses, updated_at: new Date().toISOString() },
      { onConflict: "user_id,challenge_id" }
    );
    const res: GuessResponse = { final: false, attempt: guessesUsed, round, guesses };
    return NextResponse.json(res);
  }

  // Finalize on the player's best (closest) guess.
  const bestGuess = guesses.reduce((best, g) =>
    Math.abs(g.amount - actualRent) < Math.abs(best - actualRent) ? g.amount : best,
    guesses[0].amount
  );
  const score = computeScore(bestGuess, actualRent, guessesUsed);

  const { error: insertError } = await admin.from("guesses").insert({
    user_id: user.id,
    challenge_id,
    round: guessesUsed - 1,
    guess_amount: bestGuess,
    score,
  });
  if (insertError) {
    const status = insertError.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: "Could not record guess" }, { status });
  }

  await admin.from("game_state").upsert(
    { user_id: user.id, challenge_id, current_round: 3, guesses, updated_at: new Date().toISOString() },
    { onConflict: "user_id,challenge_id" }
  );

  const newStreak = await updateStreakAndScore(admin, user.id, challenge.challenge_date, score);

  const { data: allRows } = await admin
    .from("guesses")
    .select("guess_amount, score")
    .eq("challenge_id", challenge_id);
  const rows = allRows ?? [];
  const crowdAvg = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.guess_amount, 0) / rows.length)
    : bestGuess;
  const beaten = rows.filter((r) => r.score < score).length;
  const percentile = rows.length > 1 ? Math.round((beaten / rows.length) * 100) : 100;

  const res: GuessResponse = {
    final: true,
    score,
    actual_rent: actualRent,
    crowd_avg: crowdAvg,
    edition: challenge.edition,
    guesses_used: guessesUsed,
    best_guess: bestGuess,
    guesses,
    percentile,
    streak: newStreak,
  };
  return NextResponse.json(res);
}

async function updateStreakAndScore(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  challengeDate: string,
  score: number
): Promise<number> {
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

  const mostRecentPrevDate =
    Array.isArray(previousChallengeDates) && previousChallengeDates.length > 0
      ? Array.isArray(previousChallengeDates[0].daily_challenges)
        ? previousChallengeDates[0].daily_challenges[0]?.challenge_date
        : (previousChallengeDates[0].daily_challenges as { challenge_date: string })?.challenge_date
      : null;

  const isConsecutive = mostRecentPrevDate ? isNextCalendarDay(mostRecentPrevDate, challengeDate) : false;
  const newStreak = isConsecutive ? (profile?.streak_count ?? 0) + 1 : 1;
  const newLongest = Math.max(newStreak, profile?.longest_streak ?? 0);
  const newTotal = (profile?.total_score ?? 0) + score;

  await admin.from("profiles").upsert(
    { user_id: userId, streak_count: newStreak, longest_streak: newLongest, total_score: newTotal },
    { onConflict: "user_id" }
  );
  return newStreak;
}

function isNextCalendarDay(prevDate: string, currentDate: string): boolean {
  const prev = new Date(prevDate + "T00:00:00Z");
  const current = new Date(currentDate + "T00:00:00Z");
  const diffDays = Math.round((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}
