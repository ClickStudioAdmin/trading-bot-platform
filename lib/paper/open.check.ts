import assert from "node:assert/strict";
import {
  clampNotionalInput,
  clipNotionalToBook,
  formatGroupedNumberInput,
  formatNotionalInput,
  maxPaperNotionalUsdt,
  notionalFitsBook,
  pairKey,
  paperCarryInsertRow,
  parseNotionalUsdt,
  safePaperReturnPath,
  sizeOpenNotional,
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
assert.equal(formatGroupedNumberInput("10000", true), "10,000");
assert.equal(formatGroupedNumberInput("40000", true), "40,000");
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
assert.equal(
  safePaperReturnPath("/strategies/cash-and-carry/positions"),
  "/strategies/cash-and-carry/positions",
);
assert.equal(safePaperReturnPath("/strategies/universe"), "/strategies/cash-and-carry");
assert.equal(safePaperReturnPath("/universe"), "/strategies/cash-and-carry");
assert.equal(safePaperReturnPath("/cash-and-carry"), "/strategies/cash-and-carry");
assert.equal(
  safePaperReturnPath("/evil"),
  "/strategies/cash-and-carry/opportunities",
);
assert.equal(
  safePaperReturnPath(
    "/strategies/cash-and-carry/positions?desk=11111111-1111-4111-8111-111111111111",
  ),
  "/strategies/cash-and-carry/positions?desk=11111111-1111-4111-8111-111111111111",
);
assert.equal(
  safePaperReturnPath(
    "/strategies/cash-and-carry?desk=11111111-1111-4111-8111-111111111111&paper=opened",
  ),
  "/strategies/cash-and-carry?desk=11111111-1111-4111-8111-111111111111",
);

const row = paperCarryInsertRow("user-1", opportunity, 10_000);
assert.equal(row.user_id, "user-1");
assert.equal(row.entry_basis, 0.017);
assert.equal(row.status, "open");
assert.equal(row.notional_usdt, 10_000);

assert.throws(() => paperCarryInsertRow("user-1", opportunity, 0));

assert.equal(maxPaperNotionalUsdt(50_000.9), 50_000);
assert.equal(maxPaperNotionalUsdt(0), 0);
assert.equal(notionalFitsBook(10_000, 50_000), true);
assert.equal(notionalFitsBook(50_001, 50_000), true);
assert.equal(clipNotionalToBook(50_001, 50_000), 50_000);
assert.equal(notionalFitsBook(50_002, 50_000), false);
assert.equal(notionalFitsBook(1, 0), false);
assert.equal(notionalFitsBook(1_021, 1_020.6), true);
assert.equal(notionalFitsBook(1_021, 1_020.4), true);
assert.equal(notionalFitsBook(1_022, 1_020.6), false);
assert.equal(clipNotionalToBook(1_021, 1_020.6), 1_020);
assert.equal(sizeOpenNotional(1_021, 1_020.6, 1_021), 1_020);
assert.equal(sizeOpenNotional(1_021, 900, 1_021), 900);
assert.equal(sizeOpenNotional(5_000, 900, 1_021), null);
assert.equal(sizeOpenNotional(1_021, 0, 1_021), null);
assert.equal(clampNotionalInput("60,000", 50_000), "50,000");
assert.equal(clampNotionalInput("12,000", 50_000), "12,000");

console.log("paper open checks passed");
