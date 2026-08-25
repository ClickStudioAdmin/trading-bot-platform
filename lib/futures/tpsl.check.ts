import assert from "node:assert/strict";
import {
  estimatedTpslPnl,
  paperStopHit,
  parseFuturesTpslForm,
  parseFuturesTrigger,
  validateTpslVsReference,
  venueTradingStopFields,
} from "./tpsl";

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
}

const empty = new FormData();
assert.equal(parseFuturesTpslForm(empty, undefined).ok, true);
const emptyOn = new FormData();
emptyOn.set("tpsl", "on");
assert.equal(parseFuturesTpslForm(emptyOn, undefined).ok, false);

const leftover = new FormData();
leftover.set("takeProfit", "90000");
const leftoverParsed = parseFuturesTpslForm(leftover, undefined);
assert.equal(leftoverParsed.ok, true);
if (leftoverParsed.ok) {
  assert.equal(leftoverParsed.tpsl, null);
}

assert.equal(
  validateTpslVsReference({
    side: "long",
    reference: 80000,
    tpsl: {
      takeProfit: 90000,
      stopLoss: 70000,
      tpTrigger: "last",
      slTrigger: "last",
    },
  }).ok,
  true,
);
assert.equal(
  validateTpslVsReference({
    side: "long",
    reference: 80000,
    tpsl: {
      takeProfit: 70000,
      stopLoss: null,
      tpTrigger: "last",
      slTrigger: "last",
    },
  }).ok,
  false,
);

assert.equal(
  paperStopHit({
    side: "long",
    tpsl: {
      takeProfit: 90000,
      stopLoss: 70000,
      tpTrigger: "last",
      slTrigger: "last",
    },
    last: 90000,
    mark: 89000,
    index: 89000,
  })?.kind,
  "take_profit",
);
assert.equal(
  paperStopHit({
    side: "long",
    tpsl: {
      takeProfit: 90000,
      stopLoss: 70000,
      tpTrigger: "last",
      slTrigger: "last",
    },
    last: 69999,
    mark: 80000,
    index: 80000,
  })?.kind,
  "stop_loss",
);
assert.equal(
  paperStopHit({
    side: "short",
    tpsl: {
      takeProfit: 70000,
      stopLoss: 90000,
      tpTrigger: "last",
      slTrigger: "last",
    },
    last: 70000,
    mark: 80000,
    index: 80000,
  })?.kind,
  "take_profit",
);
assert.equal(
  paperStopHit({
    side: "long",
    tpsl: {
      takeProfit: 70000,
      stopLoss: 70000,
      tpTrigger: "last",
      slTrigger: "last",
    },
    last: 70000,
    mark: 70000,
    index: 70000,
  })?.kind,
  "stop_loss",
);

assert.equal(
  estimatedTpslPnl({
    side: "long",
    qty: 0.01,
    entryPrice: 80000,
    exitPrice: 90000,
  }),
  100,
);

const cleared = venueTradingStopFields({
  takeProfit: null,
  stopLoss: 70000,
  tpTrigger: "last",
  slTrigger: "mark",
});
assert.equal(cleared.takeProfit, "0");
assert.equal(cleared.stopLoss, "70000");
assert.equal(cleared.slTriggerBy, "MarkPrice");

console.log("futures tpsl checks passed");
