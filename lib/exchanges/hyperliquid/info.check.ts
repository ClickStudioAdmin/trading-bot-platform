import assert from "node:assert/strict";
import {
  parseHyperliquidOpenOrder,
  parseHyperliquidOrderStatus,
  parseHyperliquidUserState,
} from "./info";

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

const state = parseHyperliquidUserState({
  marginSummary: { accountValue: "100", totalMarginUsed: "10" },
  withdrawable: "90",
  assetPositions: [
    {
      type: "oneWay",
      position: {
        coin: "BTC",
        szi: "1.0",
        entryPx: "50000",
        leverage: { value: "20" },
        liquidationPx: "40000",
      },
    },
    { position: { coin: "ETH", szi: "0" } },
  ],
});
assert.equal(state.positions.length, 1);
assert.equal(state.positions[0]?.coin, "BTC");
assert.equal(state.positions[0]?.size, 1);
assert.equal(state.positions[0]?.entryPx, 50000);
assert.equal(state.accountValue, 100);

console.log("hyperliquid info checks passed");
