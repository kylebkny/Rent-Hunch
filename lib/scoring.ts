/**
 * Scoring is driven primarily by how close the guess is to the actual rent.
 * Players make up to MAX_GUESSES guesses (one per clue round); the score
 * uses their BEST (closest) guess, with a gentle bonus for finishing in
 * fewer guesses. Accuracy dominates; guess count is only a small edge.
 */
export const MAX_POSSIBLE_SCORE = 1000;
export const MAX_GUESSES = 4;

// Guessing within this fraction of the actual rent counts as a "win" — a
// reasonable bar for rent (getting within 10% of a real NYC rent is good).
export const WIN_THRESHOLD = 0.1;

export function isWin(guess: number, actual: number): boolean {
  return Math.abs(guess - actual) / actual <= WIN_THRESHOLD;
}

// A guess this far off (as a fraction of actual rent) earns 0 points.
const ZERO_SCORE_ERROR_FRACTION = 0.5;

// Gentle multiplier by guesses used (index = guessesUsed - 1). Solving in
// one guess is full value; using all four shaves ~10%.
const GUESS_MULTIPLIER = [1.0, 0.97, 0.94, 0.9] as const;

function guessMultiplier(guessesUsed: number): number {
  const i = Math.max(0, guessesUsed - 1);
  return GUESS_MULTIPLIER[i] ?? GUESS_MULTIPLIER[GUESS_MULTIPLIER.length - 1];
}

/** Max score attainable when finishing in `guessesUsed` guesses (perfect). */
export function maxScoreForGuesses(guessesUsed: number): number {
  return Math.round(MAX_POSSIBLE_SCORE * guessMultiplier(guessesUsed));
}

export function accuracyFraction(guessAmount: number, actualRent: number): number {
  const errorFraction = Math.abs(guessAmount - actualRent) / actualRent;
  return Math.max(0, 1 - errorFraction / ZERO_SCORE_ERROR_FRACTION);
}

/** Score for a finished game: best guess accuracy × guesses-used bonus. */
export function computeScore(bestGuess: number, actualRent: number, guessesUsed: number): number {
  return Math.round(MAX_POSSIBLE_SCORE * accuracyFraction(bestGuess, actualRent) * guessMultiplier(guessesUsed));
}

// ─── hints ────────────────────────────────────────────────────────────────

export type HintDirection = "high" | "low" | "exact";
export type WarmthBand = "exact" | "veryClose" | "close" | "warm" | "cold";

export interface GuessHint {
  direction: HintDirection;
  band: WarmthBand;
}

export function hintFor(guess: number, actual: number): GuessHint {
  const err = Math.abs(guess - actual) / actual;
  const direction: HintDirection = guess === actual ? "exact" : guess > actual ? "high" : "low";
  const band: WarmthBand =
    err === 0 ? "exact" : err <= 0.05 ? "veryClose" : err <= 0.12 ? "close" : err <= 0.25 ? "warm" : "cold";
  return { direction, band };
}

export const DIRECTION_LABEL: Record<HintDirection, string> = {
  high: "Too high",
  low: "Too low",
  exact: "Exact",
};

export const BAND_LABEL: Record<WarmthBand, string> = {
  exact: "Spot on",
  veryClose: "Very warm",
  close: "Warm",
  warm: "Lukewarm",
  cold: "Cold",
};

export function bandEmoji(band: WarmthBand): string {
  if (band === "exact" || band === "veryClose") return "🟩";
  if (band === "close" || band === "warm") return "🟨";
  return "🟥";
}

/** Canvas colors matching the 🟩/🟨/🟥 trail, for the share image. */
export function bandColor(band: WarmthBand): string {
  if (band === "exact" || band === "veryClose") return "#16a34a";
  if (band === "close" || band === "warm") return "#eab308";
  return "#ef4444";
}

export function guessTrailEmoji(bands: WarmthBand[]): string {
  return bands.map(bandEmoji).join("");
}
