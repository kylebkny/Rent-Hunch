"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { GameCard } from "@/components/GameCard";
import { RevealScreen } from "@/components/RevealScreen";
import { SITE_NAME } from "@/lib/brand";
import type {
  GuessAttempt,
  GuessFinalResponse,
  GuessResponse,
  TodayChallengeResponse,
} from "@/lib/types";

type CachedReveal = GuessFinalResponse;

function revealCacheKey(challengeId: string) {
  return `wtr-reveal-${challengeId}`;
}

type Status = "loading" | "error" | "empty" | "playing" | "revealed" | "played-elsewhere";

export function RentHunchGame() {
  const [status, setStatus] = useState<Status>("loading");
  const [today, setToday] = useState<TodayChallengeResponse | null>(null);
  const [attempts, setAttempts] = useState<GuessAttempt[]>([]);
  const [round, setRound] = useState(0);
  const [reveal, setReveal] = useState<CachedReveal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error && !cancelled) {
          setErrorMessage("Couldn't start a session. Please refresh.");
          setStatus("error");
          return;
        }
      }

      const res = await fetch("/api/challenge/today");
      if (res.status === 404) {
        if (!cancelled) setStatus("empty");
        return;
      }
      if (!res.ok) {
        if (!cancelled) {
          setErrorMessage("Something went wrong loading today's game.");
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

      if (data.game_state) {
        setAttempts(data.game_state.guesses ?? []);
        setRound(data.game_state.current_round ?? 0);
      } else {
        await fetch("/api/state", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge_id: data.challenge_id, current_round: 0 }),
        });
      }
      setStatus("playing");
    }

    init();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(amount: number, final: boolean) {
    if (!today) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: today.challenge_id, guess_amount: amount, final }),
      });
      if (!res.ok) {
        setErrorMessage("Couldn't submit your guess. Please try again.");
        return;
      }
      const data: GuessResponse = await res.json();
      if (data.final) {
        writeCachedReveal(today.challenge_id, data);
        setReveal(data);
        setStatus("revealed");
      } else {
        setAttempts(data.guesses);
        setRound(data.round);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return <p className="text-center text-faint">Pulling the file…</p>;
  }

  if (status === "error") {
    return (
      <div className="w-full max-w-md mx-auto rounded-3xl bg-paper text-ink p-8 text-center shadow-2xl shadow-black/40">
        <p className="text-muted">{errorMessage}</p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="w-full max-w-md mx-auto rounded-3xl bg-paper text-ink p-8 text-center flex flex-col gap-3 shadow-2xl shadow-black/40">
        <p className="text-4xl">🏠</p>
        <p className="font-semibold text-lg">No listing today — yet.</p>
        <p className="text-sm text-muted">
          A fresh NYC rental drops every morning. In the meantime, try a random one.
        </p>
        <Link
          href="/play"
          className="mt-1 rounded-full bg-ink text-paper font-semibold py-3 px-6 hover:bg-ink-soft transition"
        >
          Play a random listing →
        </Link>
      </div>
    );
  }

  if (status === "played-elsewhere" && today?.guess) {
    return (
      <div className="w-full max-w-md mx-auto rounded-3xl bg-paper text-ink p-8 text-center flex flex-col gap-3 shadow-2xl shadow-black/40">
        <p className="eyebrow">{SITE_NAME} #{today.edition}</p>
        <p className="text-muted">You already played today.</p>
        <p className="text-3xl font-bold tabular-nums">{today.guess.score}/1000 pts</p>
        <p className="text-xs text-faint">Full results are on the device you played from.</p>
      </div>
    );
  }

  if (status === "revealed" && today && reveal) {
    return <RevealScreen today={today} reveal={reveal} />;
  }

  if (status === "playing" && today) {
    return (
      <GameCard
        clues={today.clues}
        photos={today.photos}
        round={round}
        attempts={attempts}
        onSubmit={handleSubmit}
        submitting={submitting}
        sliderMax={today.slider_max}
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
    // Storage unavailable — reveal just won't persist across reloads.
  }
}
