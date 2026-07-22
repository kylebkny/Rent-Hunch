"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { GameCard } from "@/components/GameCard";
import { RevealScreen } from "@/components/RevealScreen";
import type { GuessResponse, TodayChallengeResponse } from "@/lib/types";

type CachedReveal = GuessResponse & { guess_amount: number };

function revealCacheKey(challengeId: string) {
  return `rent-hunch-reveal-${challengeId}`;
}

type Status = "loading" | "error" | "playing" | "revealed" | "played-elsewhere";

export function RentHunchGame() {
  const [status, setStatus] = useState<Status>("loading");
  const [today, setToday] = useState<TodayChallengeResponse | null>(null);
  const [reveal, setReveal] = useState<CachedReveal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          if (!cancelled) {
            setErrorMessage("Couldn't start a session. Please refresh.");
            setStatus("error");
          }
          return;
        }
      }

      const res = await fetch("/api/challenge/today");
      if (!res.ok) {
        if (!cancelled) {
          setErrorMessage("No challenge is available today. Check back soon.");
          setStatus("error");
        }
        return;
      }

      const data: TodayChallengeResponse = await res.json();
      if (cancelled) return;
      setToday(data);

      if (data.guess) {
        const cached = readCachedReveal(data.challenge_id);
        if (cached) {
          setReveal(cached);
          setStatus("revealed");
        } else {
          setStatus("played-elsewhere");
        }
        return;
      }

      if (!data.game_state) {
        await fetch("/api/state", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge_id: data.challenge_id, current_round: 0 }),
        });
      }

      setStatus("playing");
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdvanceRound(round: number) {
    if (!today) return;
    await fetch("/api/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge_id: today.challenge_id, current_round: round }),
    });
  }

  async function handleLockGuess(guessAmount: number) {
    if (!today) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: today.challenge_id, guess_amount: guessAmount }),
      });
      if (!res.ok) {
        setErrorMessage("Couldn't lock your guess. Please try again.");
        return;
      }
      const data: GuessResponse = await res.json();
      const cachedReveal: CachedReveal = { ...data, guess_amount: guessAmount };
      writeCachedReveal(today.challenge_id, cachedReveal);
      setReveal(cachedReveal);
      setStatus("revealed");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return <p className="text-center font-mono text-paper-dim">Pulling the file…</p>;
  }

  if (status === "error") {
    return <p className="text-center font-mono text-brick-red">{errorMessage}</p>;
  }

  if (status === "played-elsewhere" && today?.guess) {
    return (
      <div className="text-center flex flex-col gap-3">
        <p className="font-mono text-paper-dim">
          You already played Rent Hunch #{today.edition} today.
        </p>
        <p className="font-display text-2xl">{today.guess.score}/1000 pts</p>
        <p className="font-mono text-sm text-paper-dim">
          Your guess: ${today.guess.guess_amount.toLocaleString()}
        </p>
        <p className="font-mono text-xs text-paper-dim/70">
          (Reveal details are only available on the device you played from.)
        </p>
      </div>
    );
  }

  if (status === "revealed" && today && reveal) {
    return (
      <RevealScreen
        edition={reveal.edition}
        round={reveal.round}
        guessAmount={reveal.guess_amount}
        score={reveal.score}
        actualRent={reveal.actual_rent}
        crowdAvg={reveal.crowd_avg}
      />
    );
  }

  if (status === "playing" && today) {
    return (
      <GameCard
        clues={today.clues}
        initialRound={today.game_state?.current_round ?? 0}
        onAdvanceRound={handleAdvanceRound}
        onLockGuess={handleLockGuess}
        submitting={submitting}
      />
    );
  }

  return null;
}

function readCachedReveal(challengeId: string): CachedReveal | null {
  try {
    const raw = localStorage.getItem(revealCacheKey(challengeId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedReveal(challengeId: string, data: CachedReveal) {
  try {
    localStorage.setItem(revealCacheKey(challengeId), JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, quota) — reveal just won't persist across reloads.
  }
}
