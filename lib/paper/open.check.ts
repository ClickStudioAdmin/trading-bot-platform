import assert from "node:assert/strict";
import {
  formatGroupedNumberInput,
  formatNotionalInput,
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
assert.equal(parseNotionalUsdt("10,000"), 10_000);
assert.equal(formatNotionalInput("10000"), "10,000");
assert.equal(formatNotionalInput("10,000"), "10,000");
assert.equal(formatGroupedNumberInput("1234.5", true), "1,234.5");
assert.equal(formatGroupedNumberInput("1,234.50", true), "1,234.50");
assert.equal(formatGroupedNumberInput(".", true), "0.");
assert.equal(formatGroupedNumberInput("10.5", false), "105");
assert.equal(parseNotionalUsdt("0"), null);
assert.equal(parseNotionalUsdt("-1"), null);
assert.equal(
  safePaperReturnPath("/strategies/cash-and-carry"),
  "/strategies/cash-and-carry",
);
assert.equal(safePaperReturnPath("/strategies/universe"), "/strategies/cash-and-carry");
assert.equal(safePaperReturnPath("/universe"), "/strategies/cash-and-carry");
assert.equal(safePaperReturnPath("/cash-and-carry"), "/strategies/cash-and-carry");
assert.equal(
  safePaperReturnPath("/evil"),
  "/strategies/cash-and-carry/opportunities",
);

const row = paperCarryInsertRow("user-1", opportunity, 10_000);
assert.equal(row.user_id, "user-1");
assert.equal(row.entry_basis, 0.017);
assert.equal(row.status, "open");
assert.equal(row.notional_usdt, 10_000);

assert.throws(() => paperCarryInsertRow("user-1", opportunity, 0));

console.log("paper open checks passed");
