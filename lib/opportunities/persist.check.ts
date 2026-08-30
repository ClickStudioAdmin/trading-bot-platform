import assert from "node:assert/strict";
import { storedRowToOpportunity } from "./persist";

const nowMs = Date.parse("2026-08-24T08:00:00.000Z");
const row = storedRowToOpportunity(
  {
    base_coin: "BTC",
    spot_symbol: "BTCUSDT",
    future_symbol: "BTCUSDT-25JUN27",
    delivery_time: "2027-06-25T08:00:00.000Z",
    future_bid: 110_000,
    spot_ask: 100_000,
    executable_basis: 0.1,
    fee_rate: 0.0015,
    net_basis: 0.0985,
    net_apr: 0.04,
    capacity_usdt: 50_000,
    scanned_at: "2026-08-24T07:59:00.000Z",
  },
  nowMs,
);

assert.ok(row);
assert.equal(row.baseCoin, "BTC");
assert.equal(row.spotSymbol, "BTCUSDT");
assert.equal(
  row.daysToExpiry,
  (Date.parse("2027-06-25T08:00:00.000Z") - nowMs) / 86_400_000,
);
assert.ok(row.netApr !== null && Math.abs(row.netApr - (0.0985 * 365) / row.daysToExpiry) < 1e-12);
assert.equal(storedRowToOpportunity({} as never), null);

console.log("opportunity persist checks passed");
