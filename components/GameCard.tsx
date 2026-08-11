"use client";

import { useState } from "react";
import { BuildingFacade } from "@/components/BuildingFacade";
import { PhotoReveal } from "@/components/PhotoReveal";
import {
  MAX_GUESSES,
  maxScoreForGuesses,
  bandEmoji,
  BAND_LABEL,
  DIRECTION_LABEL,
  type WarmthBand,
} from "@/lib/scoring";
import { sfx } from "@/lib/sound";
import { buzz } from "@/lib/haptics";
import { describeNeighborhood } from "@/lib/neighborhoods";
import { formatBaths } from "@/lib/listing-options";
import { TrainBullets } from "@/components/TrainBullets";
import {
  SLIDER_MIN,
  DEFAULT_SLIDER_MAX,
  GUESS_STEP,
  SLIDER_TRACK_STEPS,
  positionToRent,
  rentToPosition,
} from "@/lib/guess-slider";
import type { GuessAttempt, HintReveal, ListingClues } from "@/lib/types";

interface GameCardProps {
  clues: ListingClues;
  photos: string[];
  round: number;
  attempts: GuessAttempt[];
  onSubmit: (amount: number, final: boolean) => void;
  submitting: boolean;
  /** Slider ceiling from the featurable-listing pool; falls back if unset. */
  sliderMax?: number;
  /**
   * Hint token state. Omit entirely to hide the hint UI (freeplay doesn't
   * have per-puzzle game_state to persist a spent token against). `null`
   * means unspent; an object means it's been spent and this is the reveal.
   */
  hint?: HintReveal | null;
  onUseHint?: () => void;
  usingHint?: boolean;
}

function warmthClass(band: WarmthBand): string {
  if (band === "exact" || band === "veryClose") return "text-success";
  if (band === "close" || band === "warm") return "text-amber-600";
  return "text-blue-500";
}

export function GameCard({
  clues,
  photos,
  round,
  attempts,
  onSubmit,
  submitting,
  sliderMax,
  hint,
  onUseHint,
  usingHint,
}: GameCardProps) {
  const [guess, setGuess] = useState(2500);
  const guessesLeft = MAX_GUESSES - attempts.length;
  const last = attempts[attempts.length - 1];
  const max = sliderMax ?? DEFAULT_SLIDER_MAX;
  // Spending the token costs the same multiplier tier as one guess-round
  // later (lib/scoring.ts) — reflected here so the point preview stays honest.
  const hintPenalty = hint ? 1 : 0;

  function adjust(pct: number) {
    setGuess((g) => Math.max(SLIDER_MIN, Math.round((g * (1 + pct)) / GUESS_STEP) * GUESS_STEP));
    sfx.tick();
    buzz.tick();
  }

  function submit(final: boolean) {
    if (final) {
      sfx.lock();
      buzz.lock();
    } else {
      sfx.reveal();
      buzz.reveal();
    }
    onSubmit(guess, final);
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5 rounded-3xl bg-paper text-ink p-6 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Clue {round + 1} of {MAX_GUESSES}</p>
        <div className="flex gap-1" aria-label={`${guessesLeft} guesses left`}>
          {Array.from({ length: MAX_GUESSES }).map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${i < attempts.length ? "bg-line" : "bg-ink"}`} />
          ))}
        </div>
      </div>

      {photos.length > 0 ? (
        <PhotoReveal photos={photos} round={round} />
      ) : (
        <div className="rounded-2xl bg-mist py-4">
          <BuildingFacade round={round} />
        </div>
      )}

      <div>
        <p className="eyebrow mb-3">Filed details</p>
        <dl className="flex flex-col divide-y divide-line text-sm">
          <ClueRow
            label="Neighborhood"
            value={`${clues.neighborhood}, ${clues.city}`}
            sub={describeNeighborhood(clues.neighborhood)}
          />
          {round >= 1 && (
            <>
              <ClueRow
                label="Layout"
                value={
                  `${clues.beds === 0 ? "Studio" : `${clues.beds} bed`} · ${formatBaths(clues.baths)}` +
                  (clues.sqft ? ` · ${clues.sqft.toLocaleString()} sqft` : "")
                }
              />
              <ClueRow label="Nearest train" value={<TrainBullets transit={clues.transit} />} />
            </>
          )}
          {round >= 2 && (
            <>
              <ClueRow label="Amenities" value={clues.amenities.length > 0 ? clues.amenities.join(" · ") : "None on file"} />
              {clues.nearby && <ClueRow label="Nearby" value={clues.nearby} />}
            </>
          )}
        </dl>
      </div>

      {attempts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">Your guesses</p>
          {attempts.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="tabular-nums font-medium">${a.amount.toLocaleString()}</span>
              <span className={`flex items-center gap-1.5 ${warmthClass(a.band)}`}>
                {DIRECTION_LABEL[a.direction]} · {BAND_LABEL[a.band]} {bandEmoji(a.band)}
              </span>
            </div>
          ))}
        </div>
      )}

      {last && (
        <p className={`text-center text-sm font-medium ${warmthClass(last.band)}`}>
          {last.direction === "exact"
            ? "Nailed it!"
            : `${DIRECTION_LABEL[last.direction]} — ${BAND_LABEL[last.band].toLowerCase()}. Try again.`}
        </p>
      )}

      {round >= 3 && hint !== undefined && (
        <div className="rounded-2xl bg-mist p-4 flex flex-col gap-2">
          <span className="eyebrow">Hint token</span>
          {hint ? (
            <>
              {hint.year_built != null && (
                <p className="text-sm">
                  <span className="font-semibold">Built</span> {hint.year_built}
                </p>
              )}
              {hint.map_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hint.map_url}
                  alt="Approximate area around the listing"
                  className="w-full rounded-xl"
                />
              )}
              {hint.year_built == null && !hint.map_url && (
                <p className="text-xs text-muted">Nothing extra on file for this one.</p>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onUseHint}
                disabled={usingHint}
                className="self-start rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-ink transition disabled:opacity-50"
              >
                {usingHint ? "Revealing…" : "🔍 Use hint token"}
              </button>
              <p className="text-xs text-muted">
                Reveals when it was built and roughly where, but costs
                about as much as a guess round would.
              </p>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <label className="eyebrow text-center">Tap to type · or drag the slider</label>
        <input
          type="text"
          inputMode="numeric"
          value={`$${guess.toLocaleString()}`}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
            setGuess(digits ? Number(digits) : 0);
          }}
          onFocus={(e) => e.target.select()}
          aria-label="Your guess in dollars"
          className="w-full text-center text-5xl font-extrabold tracking-tight text-ink tabular-nums bg-transparent focus:outline-none caret-ink"
        />
        <input
          type="range"
          min={0}
          max={SLIDER_TRACK_STEPS}
          step={1}
          value={rentToPosition(guess, SLIDER_MIN, max)}
          onChange={(e) => setGuess(positionToRent(Number(e.target.value), SLIDER_MIN, max))}
          aria-label="Your guess, drag to adjust"
          className="w-full accent-ink"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => adjust(-0.1)} className="flex-1 rounded-full border border-line py-2 text-sm font-medium hover:border-ink transition">−10%</button>
          <button type="button" onClick={() => adjust(0.1)} className="flex-1 rounded-full border border-line py-2 text-sm font-medium hover:border-ink transition">+10%</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {guessesLeft > 1 ? (
          <>
            <button
              onClick={() => submit(false)}
              disabled={submitting || guess <= 0}
              className="w-full rounded-full bg-ink text-paper font-semibold py-3.5 px-6 hover:bg-ink-soft transition disabled:opacity-50"
            >
              Submit guess · {guessesLeft} left
            </button>
            <button
              onClick={() => submit(true)}
              disabled={submitting}
              className="w-full text-sm font-medium text-muted hover:text-ink transition disabled:opacity-50"
            >
              Lock in this answer — up to {maxScoreForGuesses(attempts.length + 1 + hintPenalty)} pts
            </button>
          </>
        ) : (
          <button
            onClick={() => submit(true)}
            disabled={submitting || guess <= 0}
            className="w-full rounded-full bg-ink text-paper font-semibold py-3.5 px-6 hover:bg-ink-soft transition disabled:opacity-50"
          >
            Final guess — lock it in
          </button>
        )}
      </div>
    </div>
  );
}

function ClueRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="eyebrow shrink-0">{label}</dt>
      <dd className="text-right">
        <span className="font-medium text-ink">{value}</span>
        {sub && <span className="block text-xs text-muted font-normal mt-0.5">{sub}</span>}
      </dd>
    </div>
  );
}
