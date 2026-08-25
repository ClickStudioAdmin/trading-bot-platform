import assert from "node:assert/strict";
import { decideFuturesAction, hedgePositionIdx } from "./decide";

const openLong = decideFuturesAction({
  action: "buy",
  open: null,
  reduceOnly: false,
});
assert.equal(openLong.ok, true);
if (openLong.ok) {
  assert.equal(openLong.kind, "open");
  assert.equal(openLong.positionSide, "long");
  assert.equal(openLong.orderSide, "Buy");
  assert.equal(openLong.reduceOnly, false);
}

const addLong = decideFuturesAction({
  action: "buy",
  open: { side: "long", qty: 1 },
  reduceOnly: false,
});
assert.equal(addLong.ok, true);
if (addLong.ok) {
  assert.equal(addLong.kind, "add");
}

const hedgeShort = decideFuturesAction({
  action: "sell",
  open: null,
  reduceOnly: false,
});
assert.equal(hedgeShort.ok, true);
if (hedgeShort.ok) {
  assert.equal(hedgeShort.kind, "open");
  assert.equal(hedgeShort.positionSide, "short");
  assert.equal(hedgeShort.orderSide, "Sell");
}

assert.equal(hedgePositionIdx("long"), 1);
assert.equal(hedgePositionIdx("short"), 2);

const openShort = decideFuturesAction({
  action: "sell",
  open: null,
  reduceOnly: false,
});
assert.equal(openShort.ok, true);
if (openShort.ok) {
  assert.equal(openShort.kind, "open");
  assert.equal(openShort.positionSide, "short");
  assert.equal(openShort.orderSide, "Sell");
}

const flattenLong = decideFuturesAction({
  action: "flatten",
  open: { side: "long", qty: 0.5 },
  reduceOnly: true,
});
assert.equal(flattenLong.ok, true);
if (flattenLong.ok && flattenLong.kind === "flatten") {
  assert.equal(flattenLong.orderSide, "Sell");
  assert.equal(flattenLong.reduceOnly, true);
  assert.equal(flattenLong.qty, 0.5);
}

const flattenEmpty = decideFuturesAction({
  action: "flatten",
  open: null,
  reduceOnly: false,
});
assert.equal(flattenEmpty.ok, false);

const reduceBlocksBuy = decideFuturesAction({
  action: "buy",
  open: null,
  reduceOnly: true,
});
assert.equal(reduceBlocksBuy.ok, false);

console.log("futures decide checks passed");
