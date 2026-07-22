"use client";

import { useState } from "react";
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

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6 text-center">
      <p className="font-mono text-xs tracking-[0.2em] uppercase text-paper-dim">
        Rent Hunch #{edition}
      </p>

      <div className="relative w-full h-40 flex items-center justify-center">
        <div className="animate-stamp-in absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-brick-red text-brick-red px-8 py-4 rotate-[-8deg]">
          <div className="font-mono text-xs tracking-[0.3em] uppercase text-center mb-1">
            Actual Rent
          </div>
          <div className="font-display text-4xl font-semibold text-center">
            ${actualRent.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="font-display text-2xl">
          {score}/{MAX_POSSIBLE_SCORE} pts
        </div>
        <div className="text-2xl tracking-widest">{roundTrailEmoji(round)}</div>
      </div>

      <dl className="w-full grid grid-cols-2 gap-3 text-sm font-mono text-paper-dim border-t border-b border-paper-dim/30 py-4">
        <div>
          <dt className="uppercase text-xs tracking-wide">Your guess</dt>
          <dd className="text-paper text-lg">${guessAmount.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="uppercase text-xs tracking-wide">Crowd avg</dt>
          <dd className="text-paper text-lg">${crowdAvg.toLocaleString()}</dd>
        </div>
      </dl>

      <button
        onClick={handleShare}
        className="w-full rounded-md bg-brick-red text-paper font-medium py-3 px-6 hover:brightness-110 transition"
      >
        Share result
      </button>
      {shareStatus && <p className="text-xs text-paper-dim">{shareStatus}</p>}

      <div className="flex gap-4 text-sm font-mono text-paper-dim underline">
        <a href="/leaderboard">Leaderboard</a>
        <a href="/history">History</a>
      </div>
    </div>
  );
}
