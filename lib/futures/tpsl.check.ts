import assert from "node:assert/strict";
import type { FuturesTpsl } from "./tpsl";
import { isUnchangedTradingStop } from "../exchanges/bybit/orders";
import {
  defaultTpslLevelKind,
  estimatedTpslPnl,
  futuresTpslPercentPrice,
  paperStopCloseQty,
  paperStopHit,
  parseFuturesTpslForm,
  parseFuturesTrigger,
  resolveFuturesTpslPrices,
  tpslAfterStopHit,
  validateTpslQty,
  validateTpslVsReference,
  venueTpslFields,
  venueTradingStopFields,
  breakevenStopTpsl,
  tpslWithoutLimitExits,
} from "./tpsl";

function levels(
  partial: Pick<FuturesTpsl, "takeProfit" | "stopLoss"> & Partial<FuturesTpsl>,
): FuturesTpsl {
  return {
    tpTrigger: "last",
    slTrigger: "last",
    mode: "full",
    tpQty: null,
    slQty: null,
    tpOrderType: "market",
    slOrderType: "market",
    tpLimitPrice: null,
    slLimitPrice: null,
    ...partial,
  };
}

assert.equal(defaultTpslLevelKind(null), "percent");
assert.equal(defaultTpslLevelKind(undefined, "price"), "percent");
assert.equal(defaultTpslLevelKind(1.5, "percent"), "percent");
assert.equal(defaultTpslLevelKind(65000, "price"), "price");
assert.equal(defaultTpslLevelKind(65000), "price");

assert.equal(parseFuturesTrigger("Last").ok, true);
assert.equal(parseFuturesTrigger("index").ok, true);
assert.equal(parseFuturesTrigger("mid").ok, false);

const form = new FormData();
form.set("tpsl", "on");
form.set("takeProfit", "90000");
form.set("stopLoss", "70000");
form.set("tpTrigger", "last");
form.set("slTrigger", "mark");
const parsed = parseFuturesTpslForm(form, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  priceFilter: { tickSize: "0.1" },
});
assert.equal(parsed.ok, true);
if (parsed.ok && parsed.tpsl) {
  assert.equal(parsed.tpsl.takeProfit, 90000);
  assert.equal(parsed.tpsl.stopLoss, 70000);
  assert.equal(parsed.tpsl.slTrigger, "mark");
  assert.equal(parsed.tpsl.mode, "full");
  assert.equal(parsed.tpsl.tpQty, null);
}

const empty = new FormData();
assert.equal(parseFuturesTpslForm(empty, undefined).ok, true);
const emptyOn = new FormData();
emptyOn.set("tpsl", "on");
assert.equal(parseFuturesTpslForm(emptyOn, undefined).ok, false);

const stopOnlyEmpty = new FormData();
stopOnlyEmpty.set("tpsl", "on");
stopOnlyEmpty.set("slOn", "on");
stopOnlyEmpty.set("stopLoss", "");
stopOnlyEmpty.set("slTrigger", "last");
stopOnlyEmpty.set("tpTrigger", "last");
const stopOnlyEmptyParsed = parseFuturesTpslForm(stopOnlyEmpty, undefined);
assert.equal(stopOnlyEmptyParsed.ok, false);
if (!stopOnlyEmptyParsed.ok) {
  assert.equal(stopOnlyEmptyParsed.error, "Enter a stop loss.");
}

const stopOnlyFilled = new FormData();
stopOnlyFilled.set("tpsl", "on");
stopOnlyFilled.set("slOn", "on");
stopOnlyFilled.set("stopLoss", "70000");
stopOnlyFilled.set("slTrigger", "last");
stopOnlyFilled.set("tpTrigger", "last");
const stopOnlyFilledParsed = parseFuturesTpslForm(stopOnlyFilled, undefined);
assert.equal(stopOnlyFilledParsed.ok, true);
if (stopOnlyFilledParsed.ok && stopOnlyFilledParsed.tpsl) {
  assert.equal(stopOnlyFilledParsed.tpsl.stopLoss, 70000);
  assert.equal(stopOnlyFilledParsed.tpsl.takeProfit, null);
}

const takeOnly = new FormData();
takeOnly.set("tpsl", "on");
takeOnly.set("tpOn", "on");
takeOnly.set("takeProfit", "1.5");
takeOnly.set("tpKind", "percent");
takeOnly.set("tpTrigger", "last");
takeOnly.set("tpOrderType", "market");
const takeOnlyParsed = parseFuturesTpslForm(takeOnly, undefined);
assert.equal(takeOnlyParsed.ok, true);
if (takeOnlyParsed.ok && takeOnlyParsed.tpsl) {
  assert.equal(takeOnlyParsed.tpsl.takeProfit, 1.5);
  assert.equal(takeOnlyParsed.tpsl.tpKind, "percent");
  assert.equal(takeOnlyParsed.tpsl.stopLoss, null);
  assert.equal(takeOnlyParsed.tpsl.mode, "full");
}

const stopLimitEmpty = new FormData();
stopLimitEmpty.set("tpsl", "on");
stopLimitEmpty.set("slOn", "on");
stopLimitEmpty.set("stopLoss", "70000");
stopLimitEmpty.set("slOrderType", "limit");
stopLimitEmpty.set("slLimitPrice", "");
stopLimitEmpty.set("slTrigger", "last");
stopLimitEmpty.set("tpTrigger", "last");
assert.equal(parseFuturesTpslForm(stopLimitEmpty, undefined).ok, false);

const leftover = new FormData();
leftover.set("takeProfit", "90000");
leftover.set("tpslMode", "partial");
leftover.set("tpQty", "0.5");
const leftoverParsed = parseFuturesTpslForm(leftover, undefined);
assert.equal(leftoverParsed.ok, true);
if (leftoverParsed.ok) {
  assert.equal(leftoverParsed.tpsl, null);
}

const leftoverQtyOnFull = new FormData();
leftoverQtyOnFull.set("tpsl", "on");
leftoverQtyOnFull.set("tpslMode", "full");
leftoverQtyOnFull.set("takeProfit", "90000");
leftoverQtyOnFull.set("tpQty", "0.5");
leftoverQtyOnFull.set("tpTrigger", "last");
leftoverQtyOnFull.set("slTrigger", "last");
const leftoverQtyParsed = parseFuturesTpslForm(leftoverQtyOnFull, undefined);
assert.equal(leftoverQtyParsed.ok, true);
if (leftoverQtyParsed.ok && leftoverQtyParsed.tpsl) {
  assert.equal(leftoverQtyParsed.tpsl.mode, "full");
  assert.equal(leftoverQtyParsed.tpsl.tpQty, null);
}

const partialForm = new FormData();
partialForm.set("tpsl", "on");
partialForm.set("tpslMode", "partial");
partialForm.set("takeProfit", "90000");
partialForm.set("stopLoss", "70000");
partialForm.set("tpQty", "0.25");
partialForm.set("slQty", "0.5");
partialForm.set("tpTrigger", "last");
partialForm.set("slTrigger", "last");
const partialParsed = parseFuturesTpslForm(partialForm, undefined);
assert.equal(partialParsed.ok, true);
if (partialParsed.ok && partialParsed.tpsl) {
  assert.equal(partialParsed.tpsl.mode, "partial");
  assert.equal(partialParsed.tpsl.tpQty, 0.25);
  assert.equal(partialParsed.tpsl.slQty, 0.5);
}

const partialMissingQty = new FormData();
partialMissingQty.set("tpsl", "on");
partialMissingQty.set("tpslMode", "partial");
partialMissingQty.set("takeProfit", "90000");
partialMissingQty.set("tpTrigger", "last");
partialMissingQty.set("slTrigger", "last");
assert.equal(parseFuturesTpslForm(partialMissingQty, undefined).ok, false);

assert.equal(
  validateTpslVsReference({
    side: "long",
    reference: 80000,
    tpsl: levels({ takeProfit: 90000, stopLoss: 70000 }),
  }).ok,
  true,
);
assert.equal(
  validateTpslVsReference({
    side: "long",
    reference: 80000,
    tpsl: levels({ takeProfit: 70000, stopLoss: null }),
  }).ok,
  false,
);

assert.equal(
  validateTpslQty({
    capQty: 1,
    capLabel: "order size",
    tpsl: levels({
      takeProfit: 90000,
      stopLoss: null,
      mode: "partial",
      tpQty: 0.5,
    }),
  }).ok,
  true,
);
assert.equal(
  validateTpslQty({
    capQty: 1,
    capLabel: "order size",
    tpsl: levels({
      takeProfit: 90000,
      stopLoss: null,
      mode: "partial",
      tpQty: 2,
    }),
  }).ok,
  false,
);

assert.equal(
  paperStopHit({
    side: "long",
    tpsl: levels({ takeProfit: 90000, stopLoss: 70000 }),
    last: 90000,
    mark: 89000,
    index: 89000,
  })?.kind,
  "take_profit",
);
assert.equal(
  paperStopHit({
    side: "long",
    tpsl: levels({ takeProfit: 90000, stopLoss: 70000 }),
    last: 69999,
    mark: 80000,
    index: 80000,
  })?.kind,
  "stop_loss",
);
assert.equal(
  paperStopHit({
    side: "short",
    tpsl: levels({ takeProfit: 70000, stopLoss: 90000 }),
    last: 70000,
    mark: 80000,
    index: 80000,
  })?.kind,
  "take_profit",
);
assert.equal(
  paperStopHit({
    side: "long",
    tpsl: levels({ takeProfit: 70000, stopLoss: 70000 }),
    last: 70000,
    mark: 70000,
    index: 70000,
  })?.kind,
  "stop_loss",
);

assert.equal(
  paperStopCloseQty({
    positionQty: 1,
    kind: "take_profit",
    tpsl: levels({ takeProfit: 90000, stopLoss: 70000 }),
  }),
  1,
);
assert.equal(
  paperStopCloseQty({
    positionQty: 1,
    kind: "take_profit",
    tpsl: levels({
      takeProfit: 90000,
      stopLoss: 70000,
      mode: "partial",
      tpQty: 0.25,
      slQty: 0.5,
    }),
  }),
  0.25,
);
assert.equal(
  paperStopCloseQty({
    positionQty: 1,
    kind: "stop_loss",
    tpsl: levels({
      takeProfit: 90000,
      stopLoss: 70000,
      mode: "partial",
      tpQty: 0.25,
      slQty: 0.5,
    }),
  }),
  0.5,
);

const leftoverStop = tpslAfterStopHit(
  levels({
    takeProfit: 90000,
    stopLoss: 70000,
    mode: "partial",
    tpQty: 0.25,
    slQty: 0.5,
  }),
  "take_profit",
  0.75,
);
assert.equal(leftoverStop?.takeProfit ?? null, null);
assert.equal(leftoverStop?.stopLoss, 70000);
assert.equal(leftoverStop?.slQty, 0.5);
assert.equal(leftoverStop?.mode, "partial");

assert.equal(
  estimatedTpslPnl({
    side: "long",
    qty: 0.01,
    entryPrice: 80000,
    exitPrice: 90000,
  }),
  100,
);

const cleared = venueTradingStopFields(
  levels({
    takeProfit: null,
    stopLoss: 70000,
    slTrigger: "mark",
  }),
);
assert.equal(cleared.takeProfit, "0");
assert.equal(cleared.stopLoss, "70000");
assert.equal(cleared.slTriggerBy, "MarkPrice");
assert.equal(cleared.tpslMode, "Full");

const partialVenue = venueTpslFields(
  levels({
    takeProfit: 90000,
    stopLoss: 70000,
    mode: "partial",
    tpQty: 0.25,
    slQty: 0.5,
  }),
);
assert.equal(partialVenue?.tpslMode, "Partial");
assert.equal(partialVenue?.tpSize, "0.25");
assert.equal(partialVenue?.slSize, "0.5");
assert.equal(partialVenue?.tpOrderType, "Market");

const limitForm = new FormData();
limitForm.set("tpsl", "on");
limitForm.set("takeProfit", "90000");
limitForm.set("tpTrigger", "last");
limitForm.set("slTrigger", "last");
limitForm.set("tpOrderType", "limit");
limitForm.set("tpLimitPrice", "91000");
const limitParsed = parseFuturesTpslForm(limitForm, undefined);
assert.equal(limitParsed.ok, true);
if (limitParsed.ok && limitParsed.tpsl) {
  assert.equal(limitParsed.tpsl.tpOrderType, "limit");
  assert.equal(limitParsed.tpsl.tpLimitPrice, 91000);
}

const limitDefault = new FormData();
limitDefault.set("tpsl", "on");
limitDefault.set("takeProfit", "90000");
limitDefault.set("tpTrigger", "last");
limitDefault.set("slTrigger", "last");
limitDefault.set("tpOrderType", "limit");
const limitDefaultParsed = parseFuturesTpslForm(limitDefault, undefined);
assert.equal(limitDefaultParsed.ok, true);
if (limitDefaultParsed.ok && limitDefaultParsed.tpsl) {
  assert.equal(limitDefaultParsed.tpsl.tpLimitPrice, 90000);
}

assert.equal(
  paperStopHit({
    side: "long",
    tpsl: levels({
      takeProfit: 90000,
      stopLoss: null,
      tpOrderType: "limit",
      tpLimitPrice: 91000,
    }),
    last: 90000,
    mark: 90000,
    index: 90000,
  }),
  null,
);
assert.equal(
  paperStopHit({
    side: "long",
    tpsl: levels({
      takeProfit: 90000,
      stopLoss: null,
      tpOrderType: "limit",
      tpLimitPrice: 91000,
    }),
    last: 90000,
    mark: 91000,
    index: 90000,
  })?.price,
  91000,
);

const limitVenue = venueTpslFields(
  levels({
    takeProfit: 90000,
    stopLoss: null,
    tpOrderType: "limit",
    tpLimitPrice: 91000,
  }),
);
assert.equal(limitVenue?.tpOrderType, "Limit");
assert.equal(limitVenue?.tpLimitPrice, "91000");

const venueWithoutLimitTp = tpslWithoutLimitExits(
  levels({
    takeProfit: 90000,
    stopLoss: 70000,
    tpOrderType: "limit",
    tpLimitPrice: 90000,
  }),
);
assert.equal(venueWithoutLimitTp.takeProfit, null);
assert.equal(venueWithoutLimitTp.stopLoss, 70000);
assert.equal(venueWithoutLimitTp.tpOrderType, "market");
assert.equal(venueWithoutLimitTp.slOrderType, "market");

const longTp = futuresTpslPercentPrice({
  side: "long",
  entryPrice: 100,
  percent: 2,
  kind: "take_profit",
});
assert.equal(longTp.ok && longTp.price, 102);
const longSl = futuresTpslPercentPrice({
  side: "long",
  entryPrice: 100,
  percent: 1.5,
  kind: "stop_loss",
});
assert.equal(longSl.ok && longSl.price, 98.5);
const shortTp = futuresTpslPercentPrice({
  side: "short",
  entryPrice: 100,
  percent: 2,
  kind: "take_profit",
});
assert.equal(shortTp.ok && shortTp.price, 98);
assert.equal(
  futuresTpslPercentPrice({
    side: "long",
    entryPrice: 100,
    percent: 100,
    kind: "stop_loss",
  }).ok,
  false,
);

const percentForm = new FormData();
percentForm.set("tpsl", "on");
percentForm.set("tpKind", "percent");
percentForm.set("slKind", "percent");
percentForm.set("takeProfit", "2");
percentForm.set("stopLoss", "1.5");
const percentParsed = parseFuturesTpslForm(percentForm, undefined);
assert.equal(percentParsed.ok, true);
if (percentParsed.ok && percentParsed.tpsl) {
  assert.equal(percentParsed.tpsl.tpKind, "percent");
  assert.equal(percentParsed.tpsl.slKind, "percent");
  assert.equal(percentParsed.tpsl.takeProfit, 2);
  assert.equal(percentParsed.tpsl.stopLoss, 1.5);
  const resolved = resolveFuturesTpslPrices({
    tpsl: percentParsed.tpsl,
    side: "long",
    entryPrice: 100,
  });
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.tpsl.takeProfit, 102);
    assert.equal(resolved.tpsl.stopLoss, 98.5);
    assert.equal(resolved.tpsl.tpKind, "price");
    assert.equal(resolved.tpsl.slKind, "price");
  }
}

const tickInstrument = {
  symbol: "SOLUSDT",
  status: "Trading",
  baseCoin: "SOL",
  quoteCoin: "USDT",
  priceFilter: { tickSize: "0.1", minPrice: "0.1" },
};
const atrTp = resolveFuturesTpslPrices({
  tpsl: levels({
    takeProfit: 1212.475944322307,
    stopLoss: null,
  }),
  side: "long",
  entryPrice: 1180,
  instrument: tickInstrument,
});
assert.equal(atrTp.ok, true);
if (atrTp.ok) {
  assert.equal(atrTp.tpsl.takeProfit, 1212.4);
  assert.equal(venueTradingStopFields(atrTp.tpsl).takeProfit, "1212.4");
}

const sizedStop = breakevenStopTpsl({
  current: levels({ takeProfit: 110, stopLoss: null }),
  stop: 100,
  positionQty: 4,
  appliesQty: 2,
});
assert.equal(sizedStop.mode, "partial");
assert.equal(sizedStop.slQty, 2);
assert.equal(sizedStop.tpQty, 4);
assert.equal(sizedStop.stopLoss, 100);
const fullStop = breakevenStopTpsl({
  current: levels({ takeProfit: 110, stopLoss: 90, slQty: 1, mode: "partial" }),
  stop: 100,
  positionQty: 4,
  appliesQty: null,
});
assert.equal(fullStop.mode, "partial");
assert.equal(fullStop.slQty, 1);
assert.equal(fullStop.stopLoss, 100);

assert.equal(isUnchangedTradingStop("Bybit rejected that order: not modified"), true);
assert.equal(isUnchangedTradingStop("Bybit rejected that order: price is invalid"), false);

console.log("futures tpsl checks passed");
