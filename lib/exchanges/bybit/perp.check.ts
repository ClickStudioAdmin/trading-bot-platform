import assert from "node:assert/strict";
import {
  formatPerpPairLabel,
  isUsdtLinearPerp,
  listUsdtLinearPerps,
  priceForPerp,
  qtyForPerp,
  qtyForCopyPaperNotional,
  qtyForCopyPaperQty,
  qtyForCloseQty,
  perpVenueMinimums,
  qtyForPerpNotional,
  snapPerpPriceText,
  snapPerpSizedLimit,
} from "./perp";

assert.equal(
  formatPerpPairLabel({
    symbol: "BTCUSDT",
    baseCoin: "BTC",
    quoteCoin: "USDT",
  }),
  "BTC-USDT",
);
assert.equal(
  formatPerpPairLabel({
    symbol: "BTC",
    baseCoin: "BTC",
    quoteCoin: "USDC",
  }),
  "BTC-USDC",
);
assert.equal(
  formatPerpPairLabel({
    symbol: "1000PEPEUSDT",
    baseCoin: "1000PEPE",
    quoteCoin: "USDT",
  }),
  "1000PEPE-USDT",
);

assert.equal(
  isUsdtLinearPerp({
    symbol: "BTCUSDT",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    settleCoin: "USDT",
    contractType: "LinearPerpetual",
    deliveryTime: "0",
  }),
  true,
);
assert.equal(
  isUsdtLinearPerp({
    symbol: "BTCUSDT-27JUN26",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    contractType: "LinearFutures",
    deliveryTime: "1780000000000",
  }),
  false,
);
assert.equal(
  isUsdtLinearPerp({
    symbol: "BTCUSDT",
    status: "Closed",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    contractType: "LinearPerpetual",
  }),
  false,
);

const listed = listUsdtLinearPerps([
  {
    symbol: "PEPEUSDT",
    status: "Trading",
    baseCoin: "PEPE",
    quoteCoin: "USDT",
    contractType: "LinearPerpetual",
    deliveryTime: "0",
  },
  {
    symbol: "ETHUSDT",
    status: "Trading",
    baseCoin: "ETH",
    quoteCoin: "USDT",
    contractType: "LinearPerpetual",
    deliveryTime: "0",
  },
  {
    symbol: "BTCUSDT-27JUN26",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    contractType: "LinearFutures",
    deliveryTime: "1780000000000",
  },
  {
    symbol: "BTCUSDT",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    contractType: "LinearPerpetual",
    deliveryTime: "0",
  },
  {
    symbol: "USDCUSDT",
    status: "Trading",
    baseCoin: "USDC",
    quoteCoin: "USDT",
    contractType: "LinearPerpetual",
    deliveryTime: "0",
  },
]);
assert.deepEqual(
  listed.map((row) => row.symbol),
  ["BTCUSDT", "ETHUSDT", "PEPEUSDT"],
);

const sized = qtyForPerp(0.00123, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001" },
});
assert.equal(sized.ok, true);
if (sized.ok) {
  assert.equal(sized.qty, 0.001);
  assert.equal(sized.text, "0.001");
}

assert.deepEqual(
  perpVenueMinimums({
    symbol: "BTCUSDT",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    lotSizeFilter: {
      qtyStep: "0.001",
      minOrderQty: "0.001",
      minNotionalValue: "5",
    },
  }),
  { minQty: 0.001, minNotionalUsdt: 5 },
);

const tooSmall = qtyForPerp(0.0004, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001" },
});
assert.equal(tooSmall.ok, false);

const tooLarge = qtyForPerp(5, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001", maxOrderQty: "2" },
});
assert.equal(tooLarge.ok, false);

const atMax = qtyForPerp(2, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001", maxOrderQty: "2" },
});
assert.equal(atMax.ok, true);

const fromUsdt = qtyForPerpNotional(10_000, 50_000, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: {
    qtyStep: "0.001",
    minOrderQty: "0.001",
    minNotionalValue: "5",
  },
});
assert.equal(fromUsdt.ok, true);
if (fromUsdt.ok) {
  assert.equal(fromUsdt.qty, 0.2);
  assert.equal(fromUsdt.text, "0.200");
}

const notionalTooSmall = qtyForPerpNotional(1, 50_000, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: {
    qtyStep: "0.001",
    minOrderQty: "0.001",
    minNotionalValue: "5",
  },
});
assert.equal(notionalTooSmall.ok, false);

const paperCopy = qtyForCopyPaperNotional(7.8, 78_000);
assert.equal(paperCopy.ok, true);
if (paperCopy.ok) {
  assert.equal(paperCopy.qty, 0.0001);
}
const paperCopyQty = qtyForCopyPaperQty(0.0002);
assert.equal(paperCopyQty.ok, true);
if (paperCopyQty.ok) {
  assert.equal(paperCopyQty.qty, 0.0002);
}

const ethLot = {
  symbol: "ETHUSDT",
  status: "Trading",
  baseCoin: "ETH",
  quoteCoin: "USDT",
  lotSizeFilter: {
    qtyStep: "0.01",
    minOrderQty: "0.01",
    minNotionalValue: "5",
  },
} as const;
const liveDust = qtyForCloseQty(0.003, ethLot, false);
assert.equal(liveDust.ok, false);
const paperEthClose = qtyForCloseQty(0.003, ethLot, true);
assert.equal(paperEthClose.ok, true);
if (paperEthClose.ok) {
  assert.equal(paperEthClose.qty, 0.003);
}
const paperDogeClose = qtyForCloseQty(0.144, {
  symbol: "DOGEUSDT",
  status: "Trading",
  baseCoin: "DOGE",
  quoteCoin: "USDT",
  lotSizeFilter: {
    qtyStep: "1",
    minOrderQty: "1",
    minNotionalValue: "5",
  },
}, true);
assert.equal(paperDogeClose.ok, true);
if (paperDogeClose.ok) {
  assert.equal(paperDogeClose.qty, 0.144);
}

const priced = priceForPerp(80123.456, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  priceFilter: { tickSize: "0.1" },
});
assert.equal(priced.ok, true);
if (priced.ok) {
  assert.equal(priced.price, 80123.4);
  assert.equal(priced.text, "80123.4");
}

const btcVenue = {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: {
    qtyStep: "0.001",
    minOrderQty: "0.001",
    minNotionalValue: "5",
  },
  priceFilter: { tickSize: "0.1" },
} as const;
const dirtyClipUsdt = 100 * 1.5 ** 12;
assert.equal(dirtyClipUsdt, 12974.6337890625);
assert.equal(String(dirtyClipUsdt), "12974.6337890625");
const snappedClip = snapPerpSizedLimit({
  size: dirtyClipUsdt,
  sizeUnit: "usdt",
  limitPrice: 121315.17230055,
  instrument: btcVenue,
});
assert.equal(snappedClip.ok, true);
if (snappedClip.ok) {
  assert.equal(snappedClip.priceText, "121315.1");
  assert.equal(snappedClip.qtyText, "0.106");
}

const dirtyStop = snapPerpPriceText("74186.23456", btcVenue);
assert.equal(dirtyStop.ok, true);
if (dirtyStop.ok) {
  assert.equal(dirtyStop.text, "74186.2");
}
const clearStop = snapPerpPriceText("0", btcVenue);
assert.equal(clearStop.ok, true);
if (clearStop.ok) {
  assert.equal(clearStop.text, "0");
}

console.log("bybit perp checks passed");
