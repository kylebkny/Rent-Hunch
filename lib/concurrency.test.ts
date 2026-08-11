import { test } from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "./concurrency";

test("mapWithConcurrency: preserves input order regardless of completion order", async () => {
  const items = [30, 10, 20, 5, 15];
  const results = await mapWithConcurrency(items, 3, async (n) => {
    await new Promise((r) => setTimeout(r, n));
    return n * 2;
  });
  assert.deepEqual(results, items.map((n) => n * 2));
});

test("mapWithConcurrency: never exceeds the concurrency limit", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const items = Array.from({ length: 10 }, (_, i) => i);
  await mapWithConcurrency(items, 3, async (i) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return i;
  });
  assert.ok(maxInFlight <= 3, `expected max 3 in flight, got ${maxInFlight}`);
});

test("mapWithConcurrency: empty input resolves to empty output", async () => {
  const results = await mapWithConcurrency([], 5, async (n: number) => n);
  assert.deepEqual(results, []);
});

test("mapWithConcurrency: a limit larger than the input still runs everything once", async () => {
  const calls: number[] = [];
  const results = await mapWithConcurrency([1, 2, 3], 100, async (n) => {
    calls.push(n);
    return n + 1;
  });
  assert.deepEqual(results, [2, 3, 4]);
  assert.deepEqual(calls.sort(), [1, 2, 3]);
});
