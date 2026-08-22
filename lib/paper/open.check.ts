import assert from "node:assert/strict";
import {
  pairKey,
  paperCarryInsertRow,
  parseNotionalUsdt,
  safePaperReturnPath,
} from "./open";
import type { ScannedOpportunity } from "../opportunities/scan";

const opportunity: ScannedOpportunity = {
  baseCoin: "BTC",
  spotSymbol: "BTCUSDT",
  futureSymbol: "BTCUSDT-26DEC25",
  deliveryTimeMs: 1_767_000_000_000,
  deliveryDate: "2025-12-26",
  daysToExpiry: 100,
  futureBid: 1,
  spotAsk: 1,
  executableBasis: 0.02,
  feeRate: 0.002,
  netBasis: 0.017,
  netApr: 0.06,
  capacityUsdt: 50_000,
};

assert.equal(pairKey("BTCUSDT", "BTCUSDT-26DEC25"), "BTCUSDT|BTCUSDT-26DEC25");
assert.equal(parseNotionalUsdt("10000"), 10_000);
assert.equal(parseNotionalUsdt("0"), null);
assert.equal(parseNotionalUsdt("-1"), null);
assert.equal(safePaperReturnPath("/cash-and-carry"), "/cash-and-carry");
assert.equal(safePaperReturnPath("/evil"), "/opportunities");

const row = paperCarryInsertRow("user-1", opportunity, 10_000);
assert.equal(row.user_id, "user-1");
assert.equal(row.entry_basis, 0.017);
assert.equal(row.status, "open");
assert.equal(row.notional_usdt, 10_000);

assert.throws(() => paperCarryInsertRow("user-1", opportunity, 0));

console.log("paper open checks passed");
