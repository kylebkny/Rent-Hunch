import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore, maxScoreForGuesses, MAX_POSSIBLE_SCORE } from "./scoring";

test("maxScoreForGuesses: gentle, decreasing tiers for guesses 1-4", () => {
  const scores = [1, 2, 3, 4].map(maxScoreForGuesses);
  assert.deepEqual(scores, [1000, 970, 940, 900]);
});

test("maxScoreForGuesses: out-of-range guess counts don't crash and don't exceed the last defined tier", () => {
  assert.equal(maxScoreForGuesses(0), 1000); // clamped up to tier 1
  assert.ok(maxScoreForGuesses(10) <= 900 || maxScoreForGuesses(10) === maxScoreForGuesses(4));
});

// Regression: the hint token (app/api/guess/route.ts) scores against
// guessesUsed + 1 when spent. The hint only becomes available at round 3,
// so guessesUsed is always 3-4 by the time it's used -- a naive 4-tier
// scale would let "+1" fall off the array and clamp right back to the same
// last tier as not using the hint at all, making the cost invisible.
test("computeScore: using the hint (guessesUsed + 1 = 5) actually costs something over guessesUsed = 4", () => {
  const bestGuess = 3000;
  const actualRent = 3000; // perfect accuracy, isolates the multiplier's effect
  const withoutHint = computeScore(bestGuess, actualRent, 4);
  const withHint = computeScore(bestGuess, actualRent, 5);
  assert.ok(withHint < withoutHint, `expected a real penalty: ${withHint} was not less than ${withoutHint}`);
  assert.ok(withoutHint - withHint >= 50, `expected a clearly felt gap, got only ${withoutHint - withHint} points`);
});

test("computeScore: perfect accuracy at guessesUsed=1 hits the full possible score", () => {
  assert.equal(computeScore(3000, 3000, 1), MAX_POSSIBLE_SCORE);
});

test("computeScore: worse accuracy always scores less than better accuracy, same guess count", () => {
  const close = computeScore(3100, 3000, 2);
  const far = computeScore(4000, 3000, 2);
  assert.ok(close > far);
});
