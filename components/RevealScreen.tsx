"use client";

import { useState } from "react";
import Link from "next/link";
import { MAX_POSSIBLE_SCORE, roundTrailEmoji } from "@/lib/scoring";
import { shareResult } from "@/lib/share";

interface RevealScreenProps {
  edition: number;
  round: number;
  guessAmount: number;
  score: number;
  actualRent: number;
  crowdAvg: number;
}

export function RevealScreen({
  edition,
  round,
  guessAmount,
  score,
  actualRent,
  crowdAvg,
}: RevealScreenProps) {
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  async function handleShare() {
    setShareStatus(null);
    const result = await shareResult({ edition, round, score, actualRent });
    if (result === "downloaded") setShareStatus("Saved image — share it from your photos.");
    if (result === "failed") setShareStatus("Couldn't share — try again.");
  }

  const scorePct = Math.round((score / MAX_POSSIBLE_SCORE) * 100);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6 rounded-3xl bg-paper text-ink p-6 shadow-2xl shadow-black/40">
      <p className="eyebrow text-center">Rent Hunch #{edition}</p>

      <div className="relative h-40 flex items-center justify-center rounded-2xl bg-mist">
        <div className="animate-stamp-in absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-[3px] border-ink px-8 py-3 rotate-[-7deg]">
          <div className="eyebrow text-center !text-ink mb-0.5">Actual rent</div>
          <div className="text-4xl font-bold tracking-tight text-center tabular-nums">
            ${actualRent.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div
          className="inline-flex items-baseline gap-2 rounded-full px-4 py-1.5"
          style={{ backgroundColor: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <span className="text-2xl font-bold tabular-nums">{score}</span>
          <span className="text-sm font-medium">/ {MAX_POSSIBLE_SCORE} pts · {scorePct}%</span>
        </div>
        <div className="text-2xl tracking-widest">{roundTrailEmoji(round)}</div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm border-y border-line py-4">
        <div>
          <dt className="eyebrow">Your guess</dt>
          <dd className="text-lg font-semibold tabular-nums">${guessAmount.toLocaleString()}</dd>
        </div>
        <div className="text-right">
          <dt className="eyebrow">Crowd avg</dt>
          <dd className="text-lg font-semibold tabular-nums">${crowdAvg.toLocaleString()}</dd>
        </div>
      </dl>

      <button
        onClick={handleShare}
        className="w-full rounded-full bg-ink text-paper font-semibold py-3.5 px-6 hover:bg-ink-soft transition"
      >
        Share result
      </button>
      {shareStatus && <p className="text-xs text-muted text-center">{shareStatus}</p>}

      <div className="flex justify-center gap-6 text-sm font-medium text-muted">
        <Link href="/leaderboard" className="hover:text-ink transition">Leaderboard</Link>
        <Link href="/history" className="hover:text-ink transition">History</Link>
      </div>
    </div>
  );
}
