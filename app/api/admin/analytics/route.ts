import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface Row {
  user_id: string;
  guess_amount: number;
  score: number;
  challenge_id: string;
  daily_challenges:
    | { edition: number; challenge_date: string; listings: { neighborhood: string; actual_rent: number } | { neighborhood: string; actual_rent: number }[] }
    | { edition: number; challenge_date: string; listings: { neighborhood: string; actual_rent: number } | { neighborhood: string; actual_rent: number }[] }[];
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();

  const { data } = await admin
    .from("guesses")
    .select(
      "user_id, guess_amount, score, challenge_id, daily_challenges!inner(edition, challenge_date, listings!inner(neighborhood, actual_rent))"
    );
  const rows = (data ?? []) as Row[];

  const byChallenge = new Map<
    string,
    { edition: number; date: string; neighborhood: string; actual: number; guesses: number[]; scores: number[] }
  >();

  for (const r of rows) {
    const dc = Array.isArray(r.daily_challenges) ? r.daily_challenges[0] : r.daily_challenges;
    if (!dc) continue;
    const listing = Array.isArray(dc.listings) ? dc.listings[0] : dc.listings;
    if (!listing) continue;
    let agg = byChallenge.get(r.challenge_id);
    if (!agg) {
      agg = { edition: dc.edition, date: dc.challenge_date, neighborhood: listing.neighborhood, actual: listing.actual_rent, guesses: [], scores: [] };
      byChallenge.set(r.challenge_id, agg);
    }
    agg.guesses.push(r.guess_amount);
    agg.scores.push(r.score);
  }

  const challenges = [...byChallenge.values()]
    .map((a) => {
      const crowdAvg = Math.round(a.guesses.reduce((s, g) => s + g, 0) / a.guesses.length);
      const avgScore = Math.round(a.scores.reduce((s, g) => s + g, 0) / a.scores.length);
      const deltaPct = Math.round(((crowdAvg - a.actual) / a.actual) * 100);
      return {
        edition: a.edition,
        date: a.date,
        neighborhood: a.neighborhood,
        actual: a.actual,
        crowd_avg: crowdAvg,
        players: a.guesses.length,
        avg_score: avgScore,
        delta_pct: deltaPct,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const overall = {
    players: new Set(rows.map((r) => r.user_id)).size,
    games: rows.length,
    avg_score: rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0,
  };

  return NextResponse.json({ overall, challenges });
}
