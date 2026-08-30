export async function mapPool<T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const limit = Math.max(1, Math.min(16, Math.floor(concurrency)));
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) {
        return;
      }
      await fn(items[index] as T, index);
    }
  }
  const n = Math.min(limit, items.length);
  if (n === 0) {
    return;
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
}
