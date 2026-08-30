import assert from "node:assert/strict";
import { blendEntryPrice, futuresPnlUsdt, markFromTicker } from "./math";

assert.equal(blendEntryPrice(1, 100, 1, 110), 105);
assert.equal(blendEntryPrice(2, 50, 2, 50), 50);
assert.throws(() => blendEntryPrice(0, 100, 1, 110));

assert.equal(
  futuresPnlUsdt({
    side: "long",
    qty: 2,
    entryPrice: 100,
    exitPrice: 110,
  }),
  20,
);
assert.equal(
  futuresPnlUsdt({
    side: "short",
    qty: 2,
    entryPrice: 100,
    exitPrice: 90,
  }),
  20,
);
assert.equal(
  futuresPnlUsdt({
    side: "short",
    qty: 1,
    entryPrice: 100,
    exitPrice: 110,
  }),
  -10,
);

assert.equal(markFromTicker({ lastPrice: "123.5" }), 123.5);
assert.equal(markFromTicker({ bid1Price: "10", ask1Price: "12" }), 11);
assert.equal(markFromTicker({}), null);

console.log("futures math checks passed");
