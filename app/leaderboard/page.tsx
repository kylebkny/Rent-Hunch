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
    <main className="flex flex-1 flex-col items-center px-4 py-12 gap-10 max-w-lg mx-auto w-full">
      <header className="text-center">
        <h1 className="font-display text-3xl font-semibold">Leaderboard</h1>
        {challenge && (
          <p className="font-mono text-xs text-paper-dim uppercase tracking-[0.2em] mt-1">
            Rent Hunch #{challenge.edition}
          </p>
        )}
      </header>

      <section className="w-full">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-brick-red mb-3">
          Today
        </h2>
        {dailyRows.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No guesses locked in yet today.</p>
        ) : (
          <ol className="flex flex-col gap-2 font-mono text-sm">
            {dailyRows.map((row, i) => {
              const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
              return (
                <li key={i} className="flex justify-between border-b border-paper-dim/20 pb-1.5">
                  <span className="text-paper-dim">
                    {i + 1}. {profile?.display_name ?? "Anonymous"}
                  </span>
                  <span>{row.score} pts</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="w-full">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-brick-red mb-3">
          All-time
        </h2>
        {!allTimeRows || allTimeRows.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No players yet.</p>
        ) : (
          <ol className="flex flex-col gap-2 font-mono text-sm">
            {(allTimeRows as AllTimeRow[]).map((row, i) => (
              <li key={row.user_id} className="flex justify-between border-b border-paper-dim/20 pb-1.5">
                <span className="text-paper-dim">
                  {i + 1}. {row.display_name ?? "Anonymous"}
                  {row.streak_count > 0 && (
                    <span className="text-ledger-green"> · {row.streak_count}🔥</span>
                  )}
                </span>
                <span>{row.total_score} pts</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
