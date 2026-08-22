import assert from "node:assert/strict";
import { markOpenCarries, paperDeskStats, parsePaperCarryRow } from "./rows";
import type { ScannedOpportunity } from "../opportunities/scan";

const raw = {
  id: "3",
  base_coin: "BTC",
  spot_symbol: "BTCUSDT",
  future_symbol: "BTCUSDT-26DEC25",
  delivery_time: "2025-12-26T08:00:00.000Z",
  notional_usdt: "10000",
  entry_basis: "0.25",
  opened_at: "2026-08-22T00:00:00.000Z",
  status: "open",
  exit_basis: null,
  closed_at: null,
  realized_usdt: null,
  days_held: null,
  realized_apr: null,
};

const row = parsePaperCarryRow(raw);
assert.equal(row.id, 3);
assert.equal(row.notionalUsdt, 10_000);
assert.equal(row.entryBasis, 0.25);
assert.equal(row.status, "open");

const scan: ScannedOpportunity[] = [
  {
    baseCoin: "BTC",
    spotSymbol: "BTCUSDT",
    futureSymbol: "BTCUSDT-26DEC25",
    deliveryTimeMs: row.deliveryTimeMs,
    deliveryDate: "2025-12-26",
    daysToExpiry: 126,
    futureBid: 1,
    spotAsk: 1,
    executableBasis: 0.02,
    feeRate: 0.002,
    netBasis: 0.125,
    netApr: 0.04,
    capacityUsdt: 1,
  },
];

const marked = markOpenCarries([row], scan);
assert.equal(marked[0]?.markBasis, 0.125);
assert.equal(marked[0]?.unrealizedUsdt, 1210);

const stats = paperDeskStats(marked, [
  {
    ...row,
    id: 4,
    status: "closed",
    realizedUsdt: 100,
    exitBasis: 0.01,
    closedAtMs: row.openedAtMs + 86_400_000,
    daysHeld: 1,
    realizedApr: 3.65,
  },
]);
assert.equal(stats.openNotionalUsdt, 10_000);
assert.equal(stats.unrealizedUsdt, 1210);
assert.equal(stats.realizedUsdt, 100);
assert.equal(stats.closedCount, 1);
assert.equal(stats.greenCount, 1);

const unmarked = markOpenCarries([row], []);
assert.equal(unmarked[0]?.markBasis, null);
assert.equal(paperDeskStats(unmarked, []).unrealizedUsdt, null);
assert.equal(paperDeskStats([], []).unrealizedUsdt, 0);

console.log("paper row checks passed");
