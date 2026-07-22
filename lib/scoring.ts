/**
 * Max score obtainable per round. Locking earlier (fewer clues revealed)
 * risks a bigger miss but caps a higher ceiling; locking later trades
 * upside for more information. Round 0 max (1000) is the game's overall
 * max score, used as the "/1000" denominator shown on the reveal screen
 * regardless of which round the player locked at.
 */
export const ROUND_MAX_SCORE = [1000, 750, 500, 250] as const;
export const MAX_POSSIBLE_SCORE = ROUND_MAX_SCORE[0];

// A guess this far off (as a fraction of actual rent) earns 0 points.
const ZERO_SCORE_ERROR_FRACTION = 0.5;

export function computeScore(
  round: number,
  guessAmount: number,
  actualRent: number
): number {
  const roundMax = ROUND_MAX_SCORE[round] ?? ROUND_MAX_SCORE[ROUND_MAX_SCORE.length - 1];
  const errorFraction = Math.abs(guessAmount - actualRent) / actualRent;
  const accuracy = Math.max(0, 1 - errorFraction / ZERO_SCORE_ERROR_FRACTION);
  return Math.round(roundMax * accuracy);
}

export function roundTrailEmoji(lockedRound: number): string {
  return (
    "🟥".repeat(Math.max(0, lockedRound)) + "🟩"
  );
}
