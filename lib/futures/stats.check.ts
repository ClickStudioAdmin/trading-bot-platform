import assert from "node:assert/strict";
import type { FuturesOrder, FuturesPosition } from "./model";
import {
  flattenExitPrice,
  futuresClosedStats,
  futuresDaysHeld,
  futuresOpenExposure,
} from "./stats";

function closed(partial: Partial<FuturesPosition> & { realizedUsdt: number; notionalUsdt: number }): FuturesPosition {
  return {
    id: partial.id ?? "1",
    userId: "u",
    accountId: "a",
    symbol: partial.symbol ?? "BTCUSDT",
    side: "long",
    qty: 1,
    entryPrice: 100,
    notionalUsdt: partial.notionalUsdt,
    realizedUsdt: partial.realizedUsdt,
    status: "closed",
    source: "manual",
    openedAtMs: 1,
    closedAtMs: 2,
    venue: null,
    environment: null,
    takeProfit: null,
    stopLoss: null,
    tpTrigger: "last",
    slTrigger: "last",
  };
}

const empty = futuresClosedStats([]);
assert.equal(empty.closedCount, 0);
assert.equal(empty.greenCount, 0);
assert.equal(empty.realizedUsdt, 0);
assert.equal(empty.realizedPct, null);

const mixed = futuresClosedStats([
  closed({ id: "1", realizedUsdt: 20, notionalUsdt: 100 }),
  closed({ id: "2", realizedUsdt: -5, notionalUsdt: 100 }),
]);
assert.equal(mixed.closedCount, 2);
assert.equal(mixed.greenCount, 1);
assert.equal(mixed.realizedUsdt, 15);
assert.equal(mixed.realizedPct, 0.075);

assert.equal(futuresDaysHeld(0, 86_400_000), null);
assert.equal(futuresDaysHeld(0, null), null);
assert.equal(futuresDaysHeld(1_000, 1_000 + 86_400_000), 1);

const exposure = futuresOpenExposure([
  { baseCoin: "BTC", notionalUsdt: 70 },
  { baseCoin: "ETH", notionalUsdt: 30 },
]);
assert.deepEqual(exposure, [
  { baseCoin: "BTC", notionalUsdt: 70, share: 0.7 },
  { baseCoin: "ETH", notionalUsdt: 30, share: 0.3 },
]);

assert.equal(flattenExitPrice([]), null);
assert.equal(
  flattenExitPrice([
    order({ action: "buy", price: 100 }),
    order({ action: "flatten", price: 110 }),
  ]),
  110,
);

console.log("futures stats checks passed");

function order(
  partial: Pick<FuturesOrder, "action" | "price">,
): FuturesOrder {
  return {
    id: "o",
    positionId: "p",
    action: partial.action,
    qty: 1,
    price: partial.price,
    notionalUsdt: 100,
    venueOrderId: null,
    filledAtMs: 1,
  };
}
