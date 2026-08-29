import assert from "node:assert/strict";
import { parseHyperliquidOpenOrder, parseHyperliquidOrderStatus } from "./info";

const nested = parseHyperliquidOrderStatus({
  status: "order",
  order: {
    order: {
      oid: 91404,
      sz: "0.0",
      origSz: "0.01",
      avgPx: "77800.5",
    },
    status: "filled",
  },
});
assert.deepEqual(nested, {
  status: "filled",
  oid: 91404,
  sz: 0.01,
  filledSz: 0.01,
  avgPx: 77800.5,
});

const filledKeepsSz = parseHyperliquidOrderStatus({
  status: "order",
  order: {
    order: { oid: 2, sz: "0.2", origSz: "0.2" },
    status: "filled",
  },
});
assert.equal(filledKeepsSz?.filledSz, 0.2);
assert.equal(filledKeepsSz?.status, "filled");

const flat = parseHyperliquidOrderStatus({
  status: "filled",
  order: { oid: 3, sz: "0", origSz: "1" },
});
assert.equal(flat?.oid, 3);
assert.equal(flat?.filledSz, 1);

const tpLimit = parseHyperliquidOpenOrder({
  oid: 77,
  coin: "BTC",
  side: "A",
  sz: "0.2",
  limitPx: "80100",
  triggerPx: "80000",
  reduceOnly: true,
  isTrigger: true,
  tpsl: "tp",
  orderType: "Take Profit Limit",
});
assert.equal(tpLimit?.oid, 77);
assert.equal(tpLimit?.tpsl, "tp");
assert.equal(tpLimit?.limitPx, 80100);
assert.equal(tpLimit?.triggerPx, 80000);

assert.equal(parseHyperliquidOrderStatus({ status: "unknownOid" }), null);
assert.equal(parseHyperliquidOrderStatus(null), null);

console.log("hyperliquid info checks passed");
