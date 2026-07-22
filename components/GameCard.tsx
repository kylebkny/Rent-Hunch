"use client";

import { useState } from "react";
import { BuildingFacade } from "@/components/BuildingFacade";
import { ROUND_MAX_SCORE } from "@/lib/scoring";
import type { ListingClues } from "@/lib/types";

const MAX_ROUND = 3;

interface GameCardProps {
  clues: ListingClues;
  initialRound: number;
  onAdvanceRound: (round: number) => Promise<void>;
  onLockGuess: (guessAmount: number) => Promise<void>;
  submitting: boolean;
}

export function GameCard({
  clues,
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
    } finally {
      setAdvancing(false);
    }
  }

  function adjustGuess(pct: number) {
    setGuess((g) => Math.max(0, Math.round(g * (1 + pct))));
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6 border border-paper-dim/40 rounded-lg p-6 bg-ink-navy">
      <div className="text-center">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-paper-dim mb-2">
          Property Record — Round {round + 1} of {MAX_ROUND + 1}
        </p>
        <BuildingFacade round={round} />
      </div>

      <div className="font-mono text-sm">
        <p className="uppercase text-xs tracking-[0.2em] text-brick-red mb-2">Filed Details</p>
        <ul className="flex flex-col gap-1.5 text-paper-dim">
          <li>
            <span className="text-paper">{clues.neighborhood}</span>, {clues.city}
          </li>
          {round >= 1 && (
            <li>
              <span className="text-paper">{clues.beds}</span> bed /{" "}
              <span className="text-paper">{clues.baths}</span> bath ·{" "}
              <span className="text-paper">{clues.sqft.toLocaleString()}</span> sqft
            </li>
          )}
          {round >= 2 && (
            <li>
              {clues.amenities.length > 0 ? clues.amenities.join(" · ") : "No listed amenities"}
            </li>
          )}
          {round >= 3 && <li>{clues.transit}</li>}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <label className="font-mono text-xs uppercase tracking-[0.2em] text-paper-dim">
          Your guess (monthly rent)
        </label>
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl text-paper">$</span>
          <input
            type="number"
            min={0}
            step={25}
            value={guess}
            onChange={(e) => setGuess(Number(e.target.value))}
            className="flex-1 bg-transparent border-b border-paper-dim text-2xl font-display text-paper focus:outline-none focus:border-brick-red py-1"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => adjustGuess(-0.1)}
            className="flex-1 border border-paper-dim/50 rounded py-1.5 text-sm font-mono hover:border-paper"
          >
            −10%
          </button>
          <button
            type="button"
            onClick={() => adjustGuess(0.1)}
            className="flex-1 border border-paper-dim/50 rounded py-1.5 text-sm font-mono hover:border-paper"
          >
            +10%
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => onLockGuess(guess)}
          disabled={submitting}
          className="w-full rounded-md bg-brick-red text-paper font-medium py-3 px-6 hover:brightness-110 transition disabled:opacity-50"
        >
          Lock guess — up to {ROUND_MAX_SCORE[round]} pts
        </button>
        {round < MAX_ROUND && (
          <button
            onClick={handleNextClue}
            disabled={advancing || submitting}
            className="w-full text-sm font-mono text-paper-dim underline disabled:opacity-50"
          >
            {advancing ? "Loading…" : "See next clue"}
          </button>
        )}
      </div>
    </div>
  );
}
