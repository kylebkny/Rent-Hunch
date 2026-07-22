import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

interface DailyRow {
  guess_amount: number;
  score: number;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
}

interface AllTimeRow {
  user_id: string;
  display_name: string | null;
  total_score: number;
  streak_count: number;
}

export default async function LeaderboardPage() {
  const admin = createAdminClient();
  const challengeDate = todayET();

  const { data: challenge } = await admin
    .from("daily_challenges")
    .select("id, edition")
    .eq("challenge_date", challengeDate)
    .maybeSingle();

  let dailyRows: DailyRow[] = [];
  if (challenge) {
    const { data } = await admin
      .from("guesses")
      .select("guess_amount, score, profiles(display_name)")
      .eq("challenge_id", challenge.id)
      .order("score", { ascending: false })
      .limit(20);
    dailyRows = data ?? [];
  }

  const { data: allTimeRows } = await admin
    .from("profiles")
    .select("user_id, display_name, total_score, streak_count")
    .order("total_score", { ascending: false })
    .limit(20);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12 gap-8 max-w-lg mx-auto w-full">
      <header className="text-center">
        <p className="eyebrow">{challenge ? `Rent Hunch #${challenge.edition}` : "Leaderboard"}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-paper">Leaderboard</h1>
        <Link href="/" className="mt-2 inline-block text-sm text-faint hover:text-paper transition">← Back to today</Link>
      </header>

      <section className="w-full rounded-3xl bg-paper text-ink p-6 shadow-2xl shadow-black/40">
        <h2 className="eyebrow mb-4">Today</h2>
        {dailyRows.length === 0 ? (
          <p className="text-sm text-muted">No guesses locked in yet today.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line text-sm">
            {dailyRows.map((row, i) => {
              const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
              return (
                <li key={i} className="flex justify-between py-2.5">
                  <span className="text-muted">
                    <span className="tabular-nums">{i + 1}.</span> {profile?.display_name ?? "Anonymous"}
                  </span>
                  <span className="font-semibold tabular-nums">{row.score} pts</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="w-full rounded-3xl bg-paper text-ink p-6 shadow-2xl shadow-black/40">
        <h2 className="eyebrow mb-4">All-time</h2>
        {!allTimeRows || allTimeRows.length === 0 ? (
          <p className="text-sm text-muted">No players yet.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line text-sm">
            {(allTimeRows as AllTimeRow[]).map((row, i) => (
              <li key={row.user_id} className="flex justify-between py-2.5">
                <span className="text-muted">
                  <span className="tabular-nums">{i + 1}.</span> {row.display_name ?? "Anonymous"}
                  {row.streak_count > 0 && (
                    <span className="text-success"> · {row.streak_count}🔥</span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">{row.total_score} pts</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
