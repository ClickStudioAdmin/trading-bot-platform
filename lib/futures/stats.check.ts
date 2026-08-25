import assert from "node:assert/strict";
import type { FuturesPosition } from "./model";
import { futuresClosedStats } from "./stats";

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

console.log("futures stats checks passed");
