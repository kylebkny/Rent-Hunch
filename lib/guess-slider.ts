/**
 * The rent-guess slider needs to reach high enough for pricey listings
 * while staying precise where most listings actually sit. A single linear
 * scale can't do both — stretch it to cover a $15k/mo penthouse and a
 * $2,000 studio becomes a hair's width of drag — so the slider's track
 * position maps to a dollar amount logarithmically (the same idea as an
 * audio volume/frequency slider): equal drag distance covers roughly equal
 * *percentage* change in rent, not a fixed dollar amount, so more of the
 * track's resolution lands on the lower, denser part of the range. Precise
 * entry at the high end is the paired numeric input's job, not the
 * slider's — see GameCard's text input, which is unclamped.
 */

export const SLIDER_MIN = 1000;
/** Ceiling used when there's no listing-pool data to size it from yet. */
export const DEFAULT_SLIDER_MAX = 12000;
export const GUESS_STEP = 25;

/** Discrete positions the <input type="range"> track itself moves through. */
export const SLIDER_TRACK_STEPS = 1000;

// Reasonable padding above the pool's priciest listing so it doesn't sit
// pinned at the very end of the track, rounded to a clean slider value.
const CEILING_PADDING = 1.2;
const CEILING_ROUNDING = 500;

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Slider ceiling derived from the highest rent among currently-featurable
 * listings — never from today's specific listing, which would leak it.
 * Padded above that figure and never smaller than the historical default,
 * so a thin listing pool doesn't regress the common case.
 */
export function computeSliderMax(maxFeaturedRent: number | null | undefined): number {
  if (!maxFeaturedRent || !Number.isFinite(maxFeaturedRent) || maxFeaturedRent <= 0) {
    return DEFAULT_SLIDER_MAX;
  }
  const padded = roundToStep(maxFeaturedRent * CEILING_PADDING, CEILING_ROUNDING);
  return Math.max(DEFAULT_SLIDER_MAX, padded);
}

/** Slider track position (0..SLIDER_TRACK_STEPS) → dollar guess, log-scaled. */
export function positionToRent(position: number, min: number, max: number): number {
  if (max <= min) return min;
  const t = Math.min(1, Math.max(0, position / SLIDER_TRACK_STEPS));
  const rent = min * Math.pow(max / min, t);
  return Math.min(max, Math.max(min, roundToStep(rent, GUESS_STEP)));
}

/** Dollar guess → slider track position (0..SLIDER_TRACK_STEPS), log-scaled. */
export function rentToPosition(rent: number, min: number, max: number): number {
  if (max <= min) return 0;
  const r = Math.min(max, Math.max(min, rent));
  const t = Math.log(r / min) / Math.log(max / min);
  return Math.round(t * SLIDER_TRACK_STEPS);
}
