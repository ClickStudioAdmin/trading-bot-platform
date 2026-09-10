import assert from "node:assert/strict";
import {
  FUTURES_LIVE_POSITION_STATUSES,
  FUTURES_LIVE_WORKING_STATUSES,
  dcaFlattenVenuePlan,
  futuresPositionIsLive,
  futuresWorkingIsLive,
  futuresWorkingIsPendingCancel,
  mapWithConcurrency,
  selectIds,
  sidesForMark,
  workingOwnedByPerpsDisable,
  workingOwnedByPositions,
} from "./pending-close";

assert.deepEqual(FUTURES_LIVE_POSITION_STATUSES, ["open", "closing"]);
assert.deepEqual(FUTURES_LIVE_WORKING_STATUSES, ["open", "cancelling"]);
assert.equal(futuresPositionIsLive("open"), true);
assert.equal(futuresPositionIsLive("closing"), true);
assert.equal(futuresPositionIsLive("closed"), false);
assert.equal(futuresWorkingIsPendingCancel("cancelling"), true);
assert.equal(futuresWorkingIsPendingCancel("open"), false);
assert.equal(futuresWorkingIsLive("cancelling"), true);
assert.equal(futuresWorkingIsLive("filled"), false);
assert.equal(dcaFlattenVenuePlan("bybit").waitForGridBeforeFlatten, false);
assert.equal(dcaFlattenVenuePlan("bybit").useSymbolCancelAll, true);
assert.equal(dcaFlattenVenuePlan("hyperliquid").useSymbolCancelAll, false);
assert.deepEqual(selectIds([{ id: "a" }, { id: " " }, { id: "b" }]), [
  "a",
  "b",
]);
assert.deepEqual(sidesForMark("short"), ["short"]);
assert.deepEqual(sidesForMark(null, ["long"]), ["long"]);

const owned = workingOwnedByPositions(
  [
    { id: "w1", positionId: "p1", symbol: "BTCUSDT", side: "long" },
    { id: "w2", positionId: null, symbol: "BTCUSDT", side: "long" },
    { id: "w3", positionId: "p9", symbol: "ETHUSDT", side: "long" },
  ],
  [{ id: "p1", symbol: "BTCUSDT", side: "long" }],
);
assert.deepEqual(
  owned.map((row) => row.id),
  ["w1", "w2"],
);
const perpsOwned = workingOwnedByPerpsDisable(
  [
    {
      id: "w1",
      positionId: "p1",
      ruleName: "Bot A",
    },
    {
      id: "w2",
      positionId: null,
      ruleName: "Bot A",
    },
    {
      id: "w3",
      positionId: null,
      ruleName: "Other",
    },
  ],
  [{ id: "p1", ruleName: "Bot A" }],
);
assert.deepEqual(
  perpsOwned.map((row) => row.id),
  ["w1", "w2"],
);

async function main(): Promise<void> {
  const seen: number[] = [];
  let live = 0;
  let maxLive = 0;
  await mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
    live += 1;
    maxLive = Math.max(maxLive, live);
    seen.push(item);
    await Promise.resolve();
    live -= 1;
  });
  assert.deepEqual(seen.slice().sort(), [1, 2, 3, 4]);
  assert.ok(maxLive <= 2);
  console.log("pending close checks passed");
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
