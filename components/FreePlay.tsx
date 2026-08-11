"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GameCard } from "@/components/GameCard";
import { Confetti } from "@/components/Confetti";
import { useCountUp } from "@/lib/useCountUp";
import { guessTrailEmoji, bandEmoji, MAX_POSSIBLE_SCORE } from "@/lib/scoring";
import { sfx } from "@/lib/sound";
import { buzz } from "@/lib/haptics";
import type { GuessAttempt, ListingClues } from "@/lib/types";

interface Round {
  listing_id: string;
  clues: ListingClues;
  photos: string[];
  slider_max: number;
}

interface Result {
  score: number;
  actual_rent: number;
  best_guess: number;
  guesses: GuessAttempt[];
  listing_url: string | null;
}

type Status = "loading" | "error" | "playing" | "revealed";

export function FreePlay() {
  const [status, setStatus] = useState<Status>("loading");
  const [round, setRound] = useState<Round | null>(null);
  const [attempts, setAttempts] = useState<GuessAttempt[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRandom = useCallback(async () => {
    setStatus("loading");
    setAttempts([]);
    setResult(null);
    const res = await fetch("/api/freeplay/random");
    if (!res.ok) {
      setStatus("error");
      return;
    }
    setRound(await res.json());
    setStatus("playing");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- on-mount fetch
    loadRandom();
  }, [loadRandom]);

  async function handleSubmit(amount: number, final: boolean) {
    if (!round) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/freeplay/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: round.listing_id,
          guess_amount: amount,
          prior_guesses: attempts.map((a) => a.amount),
          final,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const nextAttempts = [...attempts, { amount, direction: data.hint.direction, band: data.hint.band }];
      setAttempts(nextAttempts);
      if (data.final) {
        setResult({
          score: data.score,
          actual_rent: data.actual_rent,
          best_guess: data.best_guess,
          guesses: nextAttempts,
          listing_url: data.listing_url ?? null,
        });
        setStatus("revealed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return <p className="text-center text-faint">Pulling a listing…</p>;
  }

  if (status === "error") {
    return (
      <div className="w-full max-w-md mx-auto rounded-3xl bg-paper text-ink p-8 text-center flex flex-col gap-3 shadow-2xl shadow-black/40">
        <p className="text-4xl">🗂️</p>
        <p className="text-muted">No listings are available for freeplay yet. Check back once more have been played or added.</p>
        <Link href="/" className="text-sm font-medium underline">Back to the daily</Link>
      </div>
    );
  }

  if (status === "revealed" && result) {
    return <FreeplayReveal result={result} onAnother={loadRandom} />;
  }

  if (status === "playing" && round) {
    return (
      <GameCard
        clues={round.clues}
        photos={round.photos}
        round={attempts.length}
        attempts={attempts}
        onSubmit={handleSubmit}
        submitting={submitting}
        sliderMax={round.slider_max}
      />
    );
  }

  return null;
}

function FreeplayReveal({ result, onAnother }: { result: Result; onAnother: () => void }) {
  const { score, actual_rent, best_guess, guesses, listing_url } = result;
  const displayScore = useCountUp(score, 900);
  const displayRent = useCountUp(actual_rent, 1000);
  const bands = guesses.map((g) => g.band);
  const celebrate = score >= 700;
  const offBy = Math.abs(best_guess - actual_rent);
  const offPct = Math.round((offBy / actual_rent) * 100);

  useEffect(() => {
    if (celebrate) { sfx.win(score); buzz.win(); }
    else { sfx.low(); buzz.low(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5 rounded-3xl bg-paper text-ink p-6 shadow-2xl shadow-black/40">
      {celebrate && <Confetti />}
      <p className="eyebrow text-center">Free play</p>

      <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-mist py-8">
        <div className="animate-stamp-pop inline-block border-[3px] border-ink bg-paper px-7 py-3">
          <div className="eyebrow text-center !text-ink mb-0.5">Actual rent</div>
          <div className="text-4xl font-bold tracking-tight text-center tabular-nums whitespace-nowrap">
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
          <span className="text-sm font-medium">/ {MAX_POSSIBLE_SCORE} pts</span>
        </div>
        <div className="text-2xl tracking-widest">{guessTrailEmoji(bands)}</div>
        <p className="text-sm text-muted">
          Best guess <span className="font-semibold text-ink tabular-nums">${best_guess.toLocaleString()}</span>{" "}
          · <span className="tabular-nums">${offBy.toLocaleString()}</span> ({offPct}%) off
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {guesses.map((g, i) => (
          <div key={i} className="flex items-center justify-between text-sm text-muted">
            <span className="tabular-nums">Guess {i + 1}: ${g.amount.toLocaleString()}</span>
            <span>{bandEmoji(g.band)}</span>
          </div>
        ))}
      </div>

      {listing_url && (
        <a
          href={listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-sm font-medium text-ink underline decoration-line hover:decoration-ink"
        >
          See the original listing ↗
        </a>
      )}

      <button
        onClick={onAnother}
        className="w-full rounded-full bg-ink text-paper font-semibold py-3.5 px-6 hover:bg-ink-soft transition"
      >
        Play another
      </button>
      <Link href="/" className="text-center text-sm font-medium text-muted hover:text-ink transition">
        Back to today&apos;s daily
      </Link>
    </div>
  );
}
