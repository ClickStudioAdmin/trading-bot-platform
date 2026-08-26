import assert from "node:assert/strict";
import {
  mapBybitOrderStatus,
  nextWorkingAmend,
  nextWorkingFill,
  paperLimitShouldFill,
  parseFuturesWorkingRow,
  workingActionLabel,
} from "./working";

assert.equal(
  paperLimitShouldFill({ orderSide: "Buy", limitPrice: 100, mark: 99 }),
  true,
);
assert.equal(
  paperLimitShouldFill({ orderSide: "Buy", limitPrice: 100, mark: 101 }),
  false,
);
assert.equal(
  paperLimitShouldFill({ orderSide: "Sell", limitPrice: 100, mark: 101 }),
  true,
);
assert.equal(
  paperLimitShouldFill({ orderSide: "Sell", limitPrice: 100, mark: 99 }),
  false,
);

const partial = nextWorkingFill({ qty: 1, filledQty: 0.2, venueFilledQty: 0.5 });
assert.equal(partial.delta, 0.3);
assert.equal(partial.nextFilled, 0.5);
assert.equal(partial.remaining, 0.5);
assert.equal(partial.done, false);

const done = nextWorkingFill({ qty: 1, filledQty: 0.5, venueFilledQty: 1 });
assert.equal(done.delta, 0.5);
assert.equal(done.done, true);
assert.equal(done.remaining, 0);

const noDouble = nextWorkingFill({
  qty: 1,
  filledQty: 0.5,
  venueFilledQty: 0.5,
});
assert.equal(noDouble.delta, 0);

const priceOnly = nextWorkingAmend({
  filledQty: 0,
  qty: 0.01,
  limitPrice: 80000,
  nextRemainingQty: 0.01,
  nextLimitPrice: 79000,
});
assert.equal(priceOnly.ok, true);
if (priceOnly.ok) {
  assert.equal(priceOnly.qtyChanged, false);
  assert.equal(priceOnly.priceChanged, true);
  assert.equal(priceOnly.limitPrice, 79000);
}

const sizeOnly = nextWorkingAmend({
  filledQty: 0.2,
  qty: 1,
  limitPrice: 80000,
  nextRemainingQty: 0.5,
  nextLimitPrice: 80000,
});
assert.equal(sizeOnly.ok, true);
if (sizeOnly.ok) {
  assert.equal(sizeOnly.qty, 0.7);
  assert.equal(sizeOnly.remainingQty, 0.5);
  assert.equal(sizeOnly.qtyChanged, true);
  assert.equal(sizeOnly.priceChanged, false);
}

assert.equal(
  nextWorkingAmend({
    filledQty: 0,
    qty: 0.01,
    limitPrice: 80000,
    nextRemainingQty: 0.01,
    nextLimitPrice: 80000,
  }).ok,
  false,
);
assert.equal(
  nextWorkingAmend({
    filledQty: 0.2,
    qty: 1,
    limitPrice: 80000,
    nextRemainingQty: 0,
    nextLimitPrice: 80000,
  }).ok,
  false,
);

assert.equal(mapBybitOrderStatus("New"), "open");
assert.equal(mapBybitOrderStatus("PartiallyFilled"), "open");
assert.equal(mapBybitOrderStatus("Filled"), "filled");
assert.equal(mapBybitOrderStatus("Cancelled"), "cancelled");
assert.equal(mapBybitOrderStatus("Rejected"), "rejected");

const parsed = parseFuturesWorkingRow({
  id: "w1",
  user_id: "u1",
  account_id: "a1",
  position_id: null,
  symbol: "BTCUSDT",
  action: "buy",
  side: "long",
  qty: 0.01,
  filled_qty: 0,
  remaining_qty: 0.01,
  limit_price: 80000,
  status: "open",
  venue: null,
  environment: null,
  venue_order_id: null,
  created_at: "2026-08-25T00:00:00.000Z",
});
assert.equal(parsed.symbol, "BTCUSDT");
assert.equal(parsed.remainingQty, 0.01);
assert.equal(parsed.takeProfit, null);
assert.equal(parsed.stopLoss, null);
assert.equal(parsed.tpTrigger, "last");
assert.equal(parsed.tpslMode, "full");
assert.equal(parsed.tpQty, null);
assert.equal(parsed.tpOrderType, "market");
assert.equal(parsed.tpLimitPrice, null);
assert.equal(parsed.trailingStop, null);
assert.equal(parsed.trailingActive, null);
assert.equal(parsed.reduceOnly, false);

const closeLimit = parseFuturesWorkingRow({
  id: "w2",
  user_id: "u1",
  account_id: "a1",
  position_id: "p1",
  symbol: "BTCUSDT",
  action: "sell",
  side: "long",
  qty: 0.01,
  filled_qty: 0,
  remaining_qty: 0.01,
  limit_price: 90000,
  status: "open",
  reduce_only: true,
  venue: null,
  environment: null,
  venue_order_id: null,
  created_at: "2026-08-26T00:00:00.000Z",
});
assert.equal(closeLimit.reduceOnly, true);
assert.equal(closeLimit.positionId, "p1");
assert.equal(workingActionLabel(closeLimit.action, closeLimit.reduceOnly), "Close");
assert.equal(workingActionLabel("buy"), "Buy");

console.log("futures working checks passed");
