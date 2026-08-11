import { test } from "node:test";
import assert from "node:assert/strict";
import { unlockedPhotoCount } from "./photo-reveal";

test("unlockedPhotoCount: scales by percentage of total, not a fixed count", () => {
  // A 10-photo listing previously showed only 4/10 by the last round; now
  // it should track 25/50/75/100% of the total each round.
  assert.equal(unlockedPhotoCount(0, 10), 3); // ceil(2.5)
  assert.equal(unlockedPhotoCount(1, 10), 5);
  assert.equal(unlockedPhotoCount(2, 10), 8); // ceil(7.5)
  assert.equal(unlockedPhotoCount(3, 10), 10);
});

test("unlockedPhotoCount: a small photo count still ramps up across rounds", () => {
  assert.equal(unlockedPhotoCount(0, 4), 1);
  assert.equal(unlockedPhotoCount(1, 4), 2);
  assert.equal(unlockedPhotoCount(2, 4), 3);
  assert.equal(unlockedPhotoCount(3, 4), 4);
});

test("unlockedPhotoCount: rounds up so 1-2 photo listings never show zero", () => {
  assert.equal(unlockedPhotoCount(0, 1), 1);
  assert.equal(unlockedPhotoCount(1, 1), 1);
  assert.equal(unlockedPhotoCount(0, 2), 1);
  assert.equal(unlockedPhotoCount(1, 2), 1);
  assert.equal(unlockedPhotoCount(2, 2), 2);
  assert.equal(unlockedPhotoCount(3, 2), 2);
});

test("unlockedPhotoCount: never exceeds the actual photo count", () => {
  for (let round = 0; round <= 3; round++) {
    assert.equal(unlockedPhotoCount(round, 3) <= 3, true);
  }
});

test("unlockedPhotoCount: zero photos stays zero", () => {
  assert.equal(unlockedPhotoCount(0, 0), 0);
  assert.equal(unlockedPhotoCount(3, 0), 0);
});

test("unlockedPhotoCount: out-of-range rounds clamp to the nearest defined round", () => {
  assert.equal(unlockedPhotoCount(-1, 10), unlockedPhotoCount(0, 10));
  assert.equal(unlockedPhotoCount(10, 10), unlockedPhotoCount(3, 10));
});

test("unlockedPhotoCount: is monotonically non-decreasing across rounds", () => {
  for (const total of [1, 2, 3, 4, 7, 10, 12]) {
    let prev = 0;
    for (let round = 0; round <= 3; round++) {
      const count = unlockedPhotoCount(round, total);
      assert.ok(count >= prev, `count decreased at round ${round} for total ${total}`);
      prev = count;
    }
  }
});
