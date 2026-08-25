import assert from "node:assert/strict";
import {
  mapBybitOrderStatus,
  nextWorkingFill,
  paperLimitShouldFill,
  parseFuturesWorkingRow,
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

console.log("futures working checks passed");
