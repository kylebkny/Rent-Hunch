"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MAX_POSSIBLE_SCORE, guessTrailEmoji, bandEmoji } from "@/lib/scoring";
import { shareResult } from "@/lib/share";
import { SITE_NAME } from "@/lib/brand";
import { sfx } from "@/lib/sound";
import { buzz } from "@/lib/haptics";
import { useCountUp } from "@/lib/useCountUp";
import { Confetti } from "@/components/Confetti";
import type { GuessFinalResponse, TodayChallengeResponse } from "@/lib/types";

const CONFETTI_THRESHOLD = 700;

function nextEtMidnightCountdown(): string {
  const now = new Date();
  // Current ET wall-clock time.
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const next = new Date(et);
  next.setHours(24, 0, 0, 0);
  const ms = next.getTime() - et.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function RevealScreen({
  today,
  reveal,
}: {
  today: TodayChallengeResponse;
  reveal: GuessFinalResponse;
}) {
  const { edition, score, actual_rent, crowd_avg, best_guess, guesses, percentile, streak, listing_url } = reveal;

  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(nextEtMidnightCountdown);
  const played = useRef(false);
  const celebrate = score >= CONFETTI_THRESHOLD;

  const displayScore = useCountUp(score, 1000);
  const displayRent = useCountUp(actual_rent, 1100);
  const bands = guesses.map((g) => g.band);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (celebrate) { sfx.win(score); buzz.win(); }
    else { sfx.low(); buzz.low(); }
  }, [score, celebrate]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(nextEtMidnightCountdown()), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleShare() {
    setShareStatus(null);
    const result = await shareResult({ edition, score, bands, guessesUsed: reveal.guesses_used });
    if (result === "downloaded") setShareStatus("Saved image — share it from your photos.");
    if (result === "failed") setShareStatus("Couldn't share — try again.");
  }

  const offBy = Math.abs(best_guess - actual_rent);
  const offPct = Math.round((offBy / actual_rent) * 100);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5 rounded-3xl bg-paper text-ink p-6 shadow-2xl shadow-black/40">
      {celebrate && <Confetti />}
      <p className="eyebrow text-center">{SITE_NAME} #{edition}</p>

      {today.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {today.photos.map((photo, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={photo}
              alt={`Listing photo ${i + 1}`}
              className={`${today.photos.length === 1 ? "w-full" : "w-52 shrink-0"} aspect-[16/10] object-cover rounded-2xl`}
            />
          ))}
        </div>
      )}

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
          Best guess{" "}
          <span className="font-semibold text-ink tabular-nums">${best_guess.toLocaleString()}</span>{" "}
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

      <dl className="grid grid-cols-3 gap-2 text-center border-y border-line py-4">
        <Stat label="Beat" value={`${percentile}%`} />
        <Stat label="Streak" value={`${streak}🔥`} />
        <Stat label="Crowd avg" value={`$${crowd_avg.toLocaleString()}`} />
      </dl>

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
        onClick={handleShare}
        className="w-full rounded-full bg-ink text-paper font-semibold py-3.5 px-6 hover:bg-ink-soft transition"
      >
        Share result
      </button>
      {shareStatus && <p className="text-xs text-muted text-center">{shareStatus}</p>}

      <NameEditor initial={reveal.display_name} />

      <p className="text-center text-sm text-muted">
        Next listing in <span className="font-semibold text-ink tabular-nums">{countdown}</span>
      </p>

      <Link
        href="/play"
        className="w-full rounded-full border border-line text-ink font-semibold py-3 text-center hover:border-ink transition"
      >
        Keep playing — free play →
      </Link>

      <div className="flex justify-center gap-6 text-sm font-medium text-muted">
        <Link href="/leaderboard" className="hover:text-ink transition">Leaderboard</Link>
        <Link href="/history" className="hover:text-ink transition">History</Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Lets the (anonymous) player set the name shown on the leaderboard — no
 *  login required. */
function NameEditor({ initial }: { initial: string | null }) {
  const [name, setName] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: trimmed }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setName(data.display_name);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={20}
          placeholder="Your name"
          autoFocus
          className="flex-1 rounded-full border border-line px-4 py-2 text-sm focus:outline-none focus:border-ink"
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-ink text-paper px-4 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>
    );
  }

  return (
    <p className="text-center text-xs text-muted">
      {name ? <>Playing as <span className="font-medium text-ink">{name}</span> · </> : "Leaderboard shows Anonymous · "}
      <button onClick={() => setEditing(true)} className="underline hover:text-ink">
        {name ? "change name" : "add a name"}
      </button>
    </p>
  );
}
