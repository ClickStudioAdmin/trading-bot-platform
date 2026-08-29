import assert from "node:assert/strict";
import { parseHyperliquidOrderStatus } from "./info";

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

assert.equal(parseHyperliquidOrderStatus({ status: "unknownOid" }), null);
assert.equal(parseHyperliquidOrderStatus(null), null);

console.log("hyperliquid info checks passed");
