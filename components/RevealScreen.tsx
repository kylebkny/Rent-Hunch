"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MAX_POSSIBLE_SCORE, roundTrailEmoji } from "@/lib/scoring";
import { shareResult } from "@/lib/share";
import { SITE_NAME } from "@/lib/brand";
import { sfx } from "@/lib/sound";
import { buzz } from "@/lib/haptics";
import { useCountUp } from "@/lib/useCountUp";
import { Confetti } from "@/components/Confetti";

const CONFETTI_THRESHOLD = 700;

interface RevealScreenProps {
  edition: number;
  round: number;
  guessAmount: number;
  score: number;
  actualRent: number;
  crowdAvg: number;
  photos: string[];
}

export function RevealScreen({
  edition,
  round,
  guessAmount,
  score,
  actualRent,
  crowdAvg,
  photos,
}: RevealScreenProps) {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const played = useRef(false);
  const celebrate = score >= CONFETTI_THRESHOLD;

  const displayScore = useCountUp(score, 1000);
  const displayRent = useCountUp(actualRent, 1100);

  // Fire the reveal sound/haptics once, on mount.
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (celebrate) {
      sfx.win(score);
      buzz.win();
    } else {
      sfx.low();
      buzz.low();
    }
  }, [score, celebrate]);

  async function handleShare() {
    setShareStatus(null);
    const result = await shareResult({ edition, round, score, actualRent });
    if (result === "downloaded") setShareStatus("Saved image — share it from your photos.");
    if (result === "failed") setShareStatus("Couldn't share — try again.");
  }

  const scorePct = Math.round((score / MAX_POSSIBLE_SCORE) * 100);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6 rounded-3xl bg-paper text-ink p-6 shadow-2xl shadow-black/40">
      {celebrate && <Confetti />}
      <p className="eyebrow text-center">{SITE_NAME} #{edition}</p>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {photos.map((photo, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={photo}
              alt={`Listing photo ${i + 1}`}
              className={`${photos.length === 1 ? "w-full" : "w-52 shrink-0"} aspect-[16/10] object-cover rounded-2xl`}
            />
          ))}
        </div>
      )}

      <div className="relative h-40 flex items-center justify-center rounded-2xl bg-mist">
        <div className="animate-stamp-in absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-[3px] border-ink px-8 py-3 rotate-[-7deg]">
          <div className="eyebrow text-center !text-ink mb-0.5">Actual rent</div>
          <div className="text-4xl font-bold tracking-tight text-center tabular-nums">
            ${displayRent.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div
          className="inline-flex items-baseline gap-2 rounded-full px-4 py-1.5"
          style={{ backgroundColor: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <span className="text-2xl font-bold tabular-nums">{displayScore}</span>
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
