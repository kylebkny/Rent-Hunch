/**
 * Runs `fn` over `items` with at most `limit` in flight at once. Used to
 * bound how many PLUTO lookups (or any other rate-limit-sensitive calls)
 * fire concurrently when enriching a batch of listings, instead of either
 * blasting everything at once (Promise.all) or going fully serial.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}
