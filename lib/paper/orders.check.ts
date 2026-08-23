import assert from "node:assert/strict";
import { formatPrice } from "../opportunities/format";
import type { ScannedOpportunity } from "../opportunities/scan";
import { EMPTY_AUTOMATION } from "./automation";
import {
  attachOrders,
  fillSlip,
  formatOrderConditions,
  formatCloseOrderWhy,
  formatOrderHeadline,
  formatOrderWhy,
  ordersForCarry,
  paperOrderInsertRow,
  parsePaperOrderRow,
  scanSnapshot,
  synthesizeOrders,
} from "./orders";
import { parsePaperCarryRow } from "./rows";

assert.equal(formatPrice(67210.25), "67,210.25");
assert.equal(formatPrice(1.23456), "1.2346");
assert.equal(formatPrice(null), "—");

const opportunity: ScannedOpportunity = {
  baseCoin: "BTC",
  spotSymbol: "BTCUSDT",
  futureSymbol: "BTCUSDT-26DEC25",
  deliveryTimeMs: 1_767_000_000_000,
  deliveryDate: "2025-12-26",
  daysToExpiry: 86.2,
  futureBid: 68040,
  spotAsk: 67210,
  executableBasis: 0.01235,
  feeRate: 0.00205,
  netBasis: 0.0103,
  netApr: 0.0436,
  capacityUsdt: 84_000,
};

assert.deepEqual(scanSnapshot(opportunity), {
  netBasis: 0.0103,
  netApr: 0.0436,
  daysToExpiry: 86.2,
  capacityUsdt: 84_000,
  executableBasis: 0.01235,
  spotAsk: 67210,
  futureBid: 68040,
  feeRate: 0.00205,
});

const insert = paperOrderInsertRow({
  userId: "user-1",
  carryId: 9,
  side: "open",
  source: "engine",
  triggerReason: null,
  notionalUsdt: 10_000,
  filledAt: new Date("2026-08-23T01:00:00.000Z"),
  opportunity,
  automation: {
    ...EMPTY_AUTOMATION,
    entrySizeType: "dynamic",
    entryMinNetApr: 0.04,
    entryMinDte: 30,
  },
});
assert.equal(insert.fill_basis, 0.0103);
assert.equal(insert.theo_spot_ask, 67210);
assert.equal(insert.entry_min_net_apr, 0.04);
assert.throws(() =>
  paperOrderInsertRow({
    ...{
      userId: "user-1",
      carryId: 9,
      side: "open" as const,
      source: "manual" as const,
      triggerReason: null,
      notionalUsdt: 0,
      filledAt: new Date(),
      opportunity,
      automation: EMPTY_AUTOMATION,
    },
  }),
);

const stored = parsePaperOrderRow({
  id: "12",
  carry_id: "9",
  side: "open",
  source: "engine",
  trigger_reason: null,
  notional_usdt: "10000",
  filled_at: "2026-08-23T01:00:00.000Z",
  fill_basis: "0.0103",
  theo_net_basis: "0.0103",
  theo_net_apr: "0.0436",
  theo_days_to_expiry: "86.2",
  theo_capacity_usdt: "84000",
  theo_executable_basis: "0.01235",
  theo_spot_ask: "67210",
  theo_future_bid: "68040",
  theo_fee_rate: "0.00205",
  entry_size_type: "dynamic",
  entry_min_net_apr: "0.04",
  entry_min_dte: "30",
});
assert.equal(stored.carryId, 9);
assert.equal(stored.theoretical.spotAsk, 67210);
assert.equal(fillSlip(stored), 0);
assert.equal(formatOrderHeadline(stored), "Open · Auto");
assert.equal(
  formatOrderWhy(stored),
  "Opened automatically. All entry conditions were true.",
);
assert.deepEqual(formatOrderConditions(stored), [
  "Order Type Dynamic (scale in)",
  "Min APR 4%",
  "Min DTE 30",
]);
assert.equal(
  formatCloseOrderWhy({
    ...stored,
    side: "close",
    source: "manual",
    triggerReason: "unwind",
    conditions: { ...EMPTY_AUTOMATION, exitSizeType: "dynamic" },
  }),
  "You closed · Dynamic (scale out)",
);
assert.equal(
  formatCloseOrderWhy({
    ...stored,
    side: "close",
    source: "manual",
    triggerReason: "unwind",
    conditions: EMPTY_AUTOMATION,
  }),
  "You unwound this clip.",
);
assert.equal(
  formatCloseOrderWhy({
    ...stored,
    side: "close",
    source: "engine",
    triggerReason: "mark_apr",
  }),
  "Closed on mark APR.",
);

const carry = parsePaperCarryRow({
  id: "3",
  base_coin: "BTC",
  spot_symbol: "BTCUSDT",
  future_symbol: "BTCUSDT-26DEC25",
  delivery_time: "2025-12-26T08:00:00.000Z",
  notional_usdt: "10000",
  entry_basis: "0.02",
  opened_at: "2026-08-22T00:00:00.000Z",
  status: "closed",
  exit_basis: "0.01",
  closed_at: "2026-08-23T00:00:00.000Z",
  realized_usdt: "80",
  days_held: "1",
  realized_apr: "2.92",
  source: "manual",
  close_source: "manual",
});
const synthesized = synthesizeOrders(carry);
assert.equal(synthesized.length, 2);
assert.equal(synthesized[0]?.side, "open");
assert.equal(synthesized[1]?.side, "close");
assert.equal(synthesized[1]?.fillBasis, 0.01);
assert.equal(ordersForCarry(carry, [stored]).length, 1);
assert.equal(ordersForCarry(carry, []).length, 2);

const attached = attachOrders(
  [carry],
  [{ ...stored, carryId: carry.id }],
);
assert.equal(attached[0]?.orders[0]?.id, 12);

console.log("paper order checks passed");
