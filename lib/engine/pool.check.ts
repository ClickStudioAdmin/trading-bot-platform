import assert from "node:assert/strict";
import { mapPool } from "./pool";

async function main(): Promise<void> {
  const seen: number[] = [];
  let inflight = 0;
  let peak = 0;
  await mapPool([1, 2, 3, 4, 5], 2, async (item) => {
    inflight += 1;
    peak = Math.max(peak, inflight);
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
    seen.push(item);
    inflight -= 1;
  });
  assert.deepEqual([...seen].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert.ok(peak <= 2);
  assert.ok(peak >= 2);

  await mapPool([], 3, async () => {
    assert.fail("empty pool should not run");
  });

  console.log("engine pool checks passed");
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
