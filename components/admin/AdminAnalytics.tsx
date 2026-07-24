"use client";

import { useEffect, useState } from "react";

interface ChallengeStat {
  edition: number;
  date: string;
  neighborhood: string;
  actual: number;
  crowd_avg: number;
  players: number;
  avg_score: number;
  delta_pct: number;
}
interface Data {
  overall: { players: number; games: number; avg_score: number };
  challenges: ChallengeStat[];
}

export function AdminAnalytics() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-faint text-sm">Loading…</p>;
  if (!data || data.challenges.length === 0) {
    return (
      <div className="rounded-3xl bg-paper text-ink p-8 text-center shadow-2xl shadow-black/40">
        <p className="text-muted">No plays yet. Stats appear once people start guessing.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Players" value={data.overall.players.toLocaleString()} />
        <Stat label="Games played" value={data.overall.games.toLocaleString()} />
        <Stat label="Avg score" value={`${data.overall.avg_score}`} />
      </div>

      <section className="rounded-3xl bg-paper text-ink p-5 shadow-2xl shadow-black/40 flex flex-col gap-3">
        <p className="eyebrow">Per day · crowd vs. actual</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Neighborhood</th>
                <th className="py-2 pr-3 font-medium text-right">Actual</th>
                <th className="py-2 pr-3 font-medium text-right">Crowd</th>
                <th className="py-2 pr-3 font-medium text-right">Read</th>
                <th className="py-2 pr-3 font-medium text-right">Players</th>
                <th className="py-2 font-medium text-right">Avg</th>
              </tr>
            </thead>
            <tbody>
              {data.challenges.map((c) => (
                <tr key={c.edition} className="border-t border-line">
                  <td className="py-2 pr-3 tabular-nums text-muted">{c.edition}</td>
                  <td className="py-2 pr-3">{c.neighborhood}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">${c.actual.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">${c.crowd_avg.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    <span className={c.delta_pct > 0 ? "text-red-600" : c.delta_pct < 0 ? "text-success" : "text-muted"}>
                      {c.delta_pct > 0 ? "+" : ""}{c.delta_pct}%
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted">{c.players}</td>
                  <td className="py-2 text-right tabular-nums">{c.avg_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          <span className="text-red-600">+%</span> = crowd guessed higher than actual (thinks it&apos;s pricier);{" "}
          <span className="text-success">−%</span> = guessed lower (thinks it&apos;s cheaper).
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper text-ink p-4 text-center shadow-lg shadow-black/30">
      <div className="eyebrow">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}
