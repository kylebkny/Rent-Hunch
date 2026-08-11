/**
 * How many of a listing's photos are unlocked at a given clue round.
 *
 * Previously this was a fixed count (`round + 1`), which meant a listing
 * with 10 photos only ever showed 4 of them by the last round, while a
 * listing with exactly 4 photos showed all of them by round 0 — the reveal
 * pace depended on how many photos happened to be on file, not on the
 * round. Scaling by percentage of the total keeps the reveal pace
 * consistent across listings: round 0 always feels like "a quarter in",
 * round 3 always shows everything.
 */

// Index = round (0..3). Round 3 is the last round the player sees while
// still guessing (MAX_GUESSES - 1), so it always reveals everything.
const REVEAL_FRACTION_BY_ROUND = [0.25, 0.5, 0.75, 1] as const;

/**
 * Round up so a 1-2 photo listing still gains something each round instead
 * of flooring to zero, and clamp to the actual photo count.
 */
export function unlockedPhotoCount(round: number, totalPhotos: number): number {
  if (totalPhotos <= 0) return 0;
  const i = Math.min(Math.max(round, 0), REVEAL_FRACTION_BY_ROUND.length - 1);
  const fraction = REVEAL_FRACTION_BY_ROUND[i];
  return Math.min(totalPhotos, Math.max(1, Math.ceil(totalPhotos * fraction)));
}
