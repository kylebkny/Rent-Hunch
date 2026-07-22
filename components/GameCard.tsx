"use client";

import { useState } from "react";
import { BuildingFacade } from "@/components/BuildingFacade";
import { PhotoReveal } from "@/components/PhotoReveal";
import { roundMaxScore } from "@/lib/scoring";
import { sfx } from "@/lib/sound";
import { buzz } from "@/lib/haptics";
import type { ListingClues } from "@/lib/types";

const MAX_ROUND = 3;

interface GameCardProps {
  clues: ListingClues;
  photos: string[];
  initialRound: number;
  onAdvanceRound: (round: number) => Promise<void>;
  onLockGuess: (guessAmount: number) => Promise<void>;
  submitting: boolean;
}

export function GameCard({
  clues,
  photos,
  initialRound,
  onAdvanceRound,
  onLockGuess,
  submitting,
}: GameCardProps) {
  const [round, setRound] = useState(initialRound);
  const [guess, setGuess] = useState<number>(2500);
  const [advancing, setAdvancing] = useState(false);

  async function handleNextClue() {
    const next = Math.min(round + 1, MAX_ROUND);
    setAdvancing(true);
    try {
      await onAdvanceRound(next);
      setRound(next);
      sfx.reveal();
      buzz.reveal();
    } finally {
      setAdvancing(false);
    }
  }

  function adjustGuess(pct: number) {
    setGuess((g) => Math.max(0, Math.round(g * (1 + pct))));
    sfx.tick();
    buzz.tick();
  }

  function handleLock() {
    sfx.lock();
    buzz.lock();
    onLockGuess(guess);
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6 rounded-3xl bg-paper text-ink p-6 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Listing {round + 1} of {MAX_ROUND + 1}</p>
        <div className="flex gap-1">
          {Array.from({ length: MAX_ROUND + 1 }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${i <= round ? "bg-ink" : "bg-line"}`}
            />
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
          <ClueRow label="Neighborhood" value={`${clues.neighborhood}, ${clues.city}`} />
          {round >= 1 && (
            <ClueRow
              label="Layout"
              value={
                `${clues.beds === 0 ? "Studio" : `${clues.beds} bed`} · ${clues.baths} bath` +
                (clues.sqft ? ` · ${clues.sqft.toLocaleString()} sqft` : "")
              }
            />
          )}
          {round >= 2 && (
            <ClueRow
              label="Amenities"
              value={clues.amenities.length > 0 ? clues.amenities.join(" · ") : "None on file"}
            />
          )}
          {round >= 3 && <ClueRow label="Nearest train" value={clues.transit} />}
          {round >= 3 && clues.nearby && <ClueRow label="Nearby" value={clues.nearby} />}
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <label className="eyebrow">Your guess — monthly rent</label>
        <div className="flex items-center gap-1 border-b-2 border-ink pb-1">
          <span className="text-2xl font-semibold">$</span>
          <input
            type="number"
            min={0}
            step={25}
            value={guess}
            onChange={(e) => setGuess(Number(e.target.value))}
            className="flex-1 bg-transparent text-2xl font-semibold tracking-tight text-ink focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => adjustGuess(-0.1)}
            className="flex-1 rounded-full border border-line py-2 text-sm font-medium hover:border-ink transition"
          >
            −10%
          </button>
          <button
            type="button"
            onClick={() => adjustGuess(0.1)}
            className="flex-1 rounded-full border border-line py-2 text-sm font-medium hover:border-ink transition"
          >
            +10%
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleLock}
          disabled={submitting}
          className="w-full rounded-full bg-ink text-paper font-semibold py-3.5 px-6 hover:bg-ink-soft transition disabled:opacity-50"
        >
          Lock guess · up to {roundMaxScore(round)} pts
        </button>
        {round < MAX_ROUND && (
          <button
            onClick={handleNextClue}
            disabled={advancing || submitting}
            className="w-full text-sm font-medium text-muted hover:text-ink transition disabled:opacity-50"
          >
            {advancing ? "Loading…" : "Reveal next clue →"}
          </button>
        )}
      </div>
    </div>
  );
}

function ClueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="eyebrow shrink-0">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
