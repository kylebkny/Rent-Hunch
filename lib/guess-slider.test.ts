import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SLIDER_MIN,
  DEFAULT_SLIDER_MAX,
  SLIDER_TRACK_STEPS,
  GUESS_STEP,
  computeSliderMax,
  positionToRent,
  rentToPosition,
} from "./guess-slider";

test("computeSliderMax: no pool data falls back to the historical default", () => {
  assert.equal(computeSliderMax(null), DEFAULT_SLIDER_MAX);
  assert.equal(computeSliderMax(undefined), DEFAULT_SLIDER_MAX);
  assert.equal(computeSliderMax(0), DEFAULT_SLIDER_MAX);
  assert.equal(computeSliderMax(-500), DEFAULT_SLIDER_MAX);
  assert.equal(computeSliderMax(NaN), DEFAULT_SLIDER_MAX);
});

test("computeSliderMax: a thin/cheap pool never shrinks below the default", () => {
  // 5000 * 1.2 = 6000, well under the 12000 default floor.
  assert.equal(computeSliderMax(5000), DEFAULT_SLIDER_MAX);
});

test("computeSliderMax: pricier pool raises the ceiling with padding, rounded", () => {
  // A $15,000/mo listing in the pool should push the ceiling well past it,
  // not leave it sitting right at the edge of the track.
  const max = computeSliderMax(15000);
  assert.ok(max > 15000, `expected ceiling above the listing's rent, got ${max}`);
  assert.equal(max % 500, 0, "ceiling should be rounded to a clean slider value");
});

test("positionToRent/rentToPosition: track endpoints map to min/max", () => {
  const min = SLIDER_MIN;
  const max = 30000;
  assert.equal(positionToRent(0, min, max), min);
  assert.equal(positionToRent(SLIDER_TRACK_STEPS, min, max), max);
  assert.equal(rentToPosition(min, min, max), 0);
  assert.equal(rentToPosition(max, min, max), SLIDER_TRACK_STEPS);
});

test("positionToRent: monotonically non-decreasing as the track position increases", () => {
  const min = SLIDER_MIN;
  const max = 30000;
  let prev = -Infinity;
  for (let p = 0; p <= SLIDER_TRACK_STEPS; p += 25) {
    const rent = positionToRent(p, min, max);
    assert.ok(rent >= prev, `rent decreased at position ${p}: ${rent} < ${prev}`);
    prev = rent;
  }
});

test("positionToRent: log scale gives finer resolution at the low end than the high end", () => {
  const min = SLIDER_MIN;
  const max = 30000;
  // Same-size drag near the bottom of the track vs. near the top.
  const lowDelta = positionToRent(100, min, max) - positionToRent(90, min, max);
  const highDelta = positionToRent(1000, min, max) - positionToRent(990, min, max);
  assert.ok(
    lowDelta < highDelta,
    `expected finer resolution at the low end (${lowDelta} vs ${highDelta})`
  );
});

test("rentToPosition/positionToRent: round-trips within one guess step", () => {
  const min = SLIDER_MIN;
  const max = 20000;
  for (const rent of [1000, 2500, 4000, 8000, 15000, 20000]) {
    const roundTripped = positionToRent(rentToPosition(rent, min, max), min, max);
    assert.ok(
      Math.abs(roundTripped - rent) <= GUESS_STEP,
      `${rent} round-tripped to ${roundTripped}, off by more than one step`
    );
  }
});

test("positionToRent: clamps out-of-range positions", () => {
  const min = SLIDER_MIN;
  const max = 20000;
  assert.equal(positionToRent(-50, min, max), min);
  assert.equal(positionToRent(SLIDER_TRACK_STEPS + 500, min, max), max);
});
