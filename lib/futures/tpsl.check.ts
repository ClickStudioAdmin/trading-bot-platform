import assert from "node:assert/strict";
import type { FuturesTpsl } from "./tpsl";
import {
  estimatedTpslPnl,
  paperStopCloseQty,
  paperStopHit,
  parseFuturesTpslForm,
  parseFuturesTrigger,
  tpslAfterStopHit,
  validateTpslQty,
  validateTpslVsReference,
  venueTpslFields,
  venueTradingStopFields,
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

console.log("futures tpsl checks passed");
