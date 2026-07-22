import Link from "next/link";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface HistoryRow {
  round: number;
  guess_amount: number;
  score: number;
  locked_at: string;
  daily_challenges:
    | { edition: number; challenge_date: string }
    | { edition: number; challenge_date: string }[]
    | null;
}

export default async function HistoryPage() {
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <p className="text-faint">Play today&apos;s challenge to start your history.</p>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("guesses")
    .select("round, guess_amount, score, locked_at, daily_challenges(edition, challenge_date)")
    .eq("user_id", user.id)
    .order("locked_at", { ascending: false });

  const rows = (data ?? []) as HistoryRow[];

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12 gap-8 max-w-lg mx-auto w-full">
      <header className="text-center">
        <p className="eyebrow">Your results</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-paper">History</h1>
        <Link href="/" className="mt-2 inline-block text-sm text-faint hover:text-paper transition">← Back to today</Link>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-faint">You haven&apos;t played yet.</p>
      ) : (
        <ol className="w-full flex flex-col gap-3">
          {rows.map((row, i) => {
            const challenge = Array.isArray(row.daily_challenges)
              ? row.daily_challenges[0]
              : row.daily_challenges;
            return (
              <li
                key={i}
                className="flex justify-between items-center rounded-2xl bg-paper text-ink px-5 py-4 shadow-lg shadow-black/30"
              >
                <div>
                  <div className="font-semibold">Rent Hunch #{challenge?.edition ?? "—"}</div>
                  <div className="text-muted text-xs">{challenge?.challenge_date}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{row.score} pts</div>
                  <div className="text-muted text-xs tabular-nums">
                    guessed ${row.guess_amount.toLocaleString()}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
