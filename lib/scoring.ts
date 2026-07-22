/**
 * Scoring is driven primarily by how close the guess is to the actual rent.
 * The round you lock on is only a small edge — locking earlier (on fewer
 * clues) earns a modest bonus, but accuracy dominates. A dead-on guess on
 * the final round still scores far higher than a wild guess on the first.
 */
export const MAX_POSSIBLE_SCORE = 1000;

// A guess this far off (as a fraction of actual rent) earns 0 points.
const ZERO_SCORE_ERROR_FRACTION = 0.5;

// Gentle per-round multiplier. Round 0 is full value; later rounds shave a
// little off, so the max ranges only ~1000→900 across rounds (vs. accuracy,
// which swings the full 0→1000).
const ROUND_MULTIPLIER = [1.0, 0.97, 0.94, 0.9] as const;

function roundMultiplier(round: number): number {
  return ROUND_MULTIPLIER[round] ?? ROUND_MULTIPLIER[ROUND_MULTIPLIER.length - 1];
}

/** Max score attainable on a given round (a perfect guess). */
export function roundMaxScore(round: number): number {
  return Math.round(MAX_POSSIBLE_SCORE * roundMultiplier(round));
}

/** Accuracy component alone, 0..1, from how close the guess is. */
export function accuracyFraction(guessAmount: number, actualRent: number): number {
  const errorFraction = Math.abs(guessAmount - actualRent) / actualRent;
  return Math.max(0, 1 - errorFraction / ZERO_SCORE_ERROR_FRACTION);
}

export function computeScore(round: number, guessAmount: number, actualRent: number): number {
  return Math.round(MAX_POSSIBLE_SCORE * accuracyFraction(guessAmount, actualRent) * roundMultiplier(round));
}

export function roundTrailEmoji(lockedRound: number): string {
  return "🟥".repeat(Math.max(0, lockedRound)) + "🟩";
}
