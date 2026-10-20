import assert from "node:assert/strict";
import {
  automationSide,
  blockedFuturesRuleDeletes,
  cloneFuturesAutomationForm,
  copyFuturesRuleName,
  decideFuturesAutomationTick,
  defaultFuturesAutomationForm,
  FUTURES_RULE_IN_USE,
  futuresAutomationIdempotencyKey,
  futuresDeskAutomationStatus,
  futuresAutomationToRow,
  parseFuturesAutomationForm,
  parseFuturesAutomationRow,
  perpsAutomationLegs,
  parseFuturesTriggerCompare,
  triggerConditionMet,
} from "./automation";
import { FUTURES_IDEMPOTENCY_MAX } from "./command";

assert.equal(parseFuturesTriggerCompare("gte").ok, true);
assert.equal(parseFuturesTriggerCompare(">=").ok, true);
assert.equal(parseFuturesTriggerCompare("lte").ok, true);
assert.equal(parseFuturesTriggerCompare("nope").ok, false);

assert.equal(triggerConditionMet(100, "gte", 100), true);
assert.equal(triggerConditionMet(99.9, "gte", 100), false);
assert.equal(triggerConditionMet(100, "lte", 100), true);
assert.equal(triggerConditionMet(100.1, "lte", 100), false);

assert.deepEqual(
  decideFuturesAutomationTick({
    conditionMet: true,
    wasTrue: false,
    action: "buy",
    mode: "active",
    bookReduceOnly: false,
    skipIfOpen: true,
    hasOpenOnSide: false,
  }),
  { fire: true, nextTrue: true },
);
assert.deepEqual(
  decideFuturesAutomationTick({
    conditionMet: true,
    wasTrue: true,
    action: "buy",
    mode: "active",
    bookReduceOnly: false,
    skipIfOpen: true,
    hasOpenOnSide: false,
  }),
  { fire: false, nextTrue: true },
);
assert.deepEqual(
  decideFuturesAutomationTick({
    conditionMet: false,
    wasTrue: true,
    action: "buy",
    mode: "active",
    bookReduceOnly: false,
    skipIfOpen: true,
    hasOpenOnSide: false,
  }),
  { fire: false, nextTrue: false },
);
assert.deepEqual(
  decideFuturesAutomationTick({
    conditionMet: true,
    wasTrue: false,
    action: "buy",
    mode: "active",
    bookReduceOnly: false,
    skipIfOpen: true,
    hasOpenOnSide: true,
  }),
  { fire: false, nextTrue: true },
);
assert.deepEqual(
  decideFuturesAutomationTick({
    conditionMet: true,
    wasTrue: false,
    action: "buy",
    mode: "active",
    bookReduceOnly: false,
    skipIfOpen: false,
    hasOpenOnSide: true,
  }),
  { fire: false, nextTrue: true },
);
assert.deepEqual(
  decideFuturesAutomationTick({
    conditionMet: true,
    wasTrue: false,
    action: "buy",
    mode: "reduce_only",
    bookReduceOnly: false,
    skipIfOpen: false,
    hasOpenOnSide: false,
  }),
  { fire: false, nextTrue: false },
);
assert.deepEqual(
  decideFuturesAutomationTick({
    conditionMet: true,
    wasTrue: false,
    action: "flatten",
    mode: "reduce_only",
    bookReduceOnly: true,
    skipIfOpen: true,
    hasOpenOnSide: true,
  }),
  { fire: true, nextTrue: true },
);
assert.deepEqual(
  decideFuturesAutomationTick({
    conditionMet: true,
    wasTrue: false,
    action: "flatten",
    mode: "active",
    bookReduceOnly: false,
    skipIfOpen: true,
    hasOpenOnSide: false,
  }),
  { fire: false, nextTrue: false },
);

assert.equal(automationSide({ action: "buy", closeSide: null }), "long");
assert.equal(automationSide({ action: "sell", closeSide: null }), "short");
assert.equal(automationSide({ action: "flatten", closeSide: "short" }), "short");

const key = futuresAutomationIdempotencyKey(
  "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  1_700_000_000_000,
);
assert.ok(key.length <= FUTURES_IDEMPOTENCY_MAX);
assert.equal(key.startsWith("a"), true);

const buy = new FormData();
buy.set("ruleCount", "1");
buy.set("r0_name", "Breakout");
buy.set("r0_mode", "active");
buy.set("r0_symbol", "btcusdt");
buy.set("r0_action", "buy");
buy.set("r0_orderType", "market");
buy.set("r0_sizeUnit", "qty");
buy.set("r0_size", "0.01");
buy.set("r0_triggerBy", "last");
buy.set("r0_triggerCompare", "gte");
buy.set("r0_triggerPrice", "90,000");
buy.set("r0_skipIfOpen", "on");
const buyParsed = parseFuturesAutomationForm(buy);
assert.equal(buyParsed.ok, true);
if (buyParsed.ok) {
  assert.equal(buyParsed.rules[0]?.symbol, "BTCUSDT");
  assert.equal(buyParsed.rules[0]?.action, "buy");
  assert.equal(buyParsed.rules[0]?.triggerPrice, 90000);
  assert.equal(buyParsed.rules[0]?.skipIfOpen, true);
  assert.equal(buyParsed.rules[0]?.tpsl, null);
}
const longName = new FormData();
for (const [key, value] of buy.entries()) {
  longName.set(key, key === "r0_name" ? "N".repeat(80) : value);
}
const longNameParsed = parseFuturesAutomationForm(longName);
assert.equal(longNameParsed.ok, true);
if (longNameParsed.ok) {
  assert.equal(longNameParsed.rules[0]?.name.length, 80);
}
const tooLongName = new FormData();
for (const [key, value] of buy.entries()) {
  tooLongName.set(key, key === "r0_name" ? "N".repeat(81) : value);
}
const tooLongParsed = parseFuturesAutomationForm(tooLongName);
assert.equal(tooLongParsed.ok, false);
if (!tooLongParsed.ok) {
  assert.equal(tooLongParsed.error, "Rule names must be 80 characters or fewer.");
}

const exits = new FormData();
exits.set("ruleCount", "1");
exits.set("r0_name", "Breakout TP");
exits.set("r0_mode", "active");
exits.set("r0_symbol", "BTCUSDT");
exits.set("r0_action", "buy");
exits.set("r0_orderType", "market");
exits.set("r0_sizeUnit", "qty");
exits.set("r0_size", "0.01");
exits.set("r0_triggerBy", "last");
exits.set("r0_triggerCompare", "gte");
exits.set("r0_triggerPrice", "90000");
exits.set("r0_tpsl", "on");
exits.set("r0_takeProfit", "95000");
exits.set("r0_stopLoss", "85000");
exits.set("r0_tpTrigger", "last");
exits.set("r0_slTrigger", "mark");
exits.set("r0_tpslMode", "full");
exits.set("r0_tpOrderType", "market");
exits.set("r0_slOrderType", "market");
const exitsParsed = parseFuturesAutomationForm(exits);
assert.equal(exitsParsed.ok, true);
if (exitsParsed.ok) {
  assert.equal(exitsParsed.rules[0]?.tpsl?.takeProfit, 95000);
  assert.equal(exitsParsed.rules[0]?.tpsl?.stopLoss, 85000);
  assert.equal(exitsParsed.rules[0]?.tpsl?.tpKind, "price");
  assert.equal(exitsParsed.rules[0]?.tpsl?.slKind, "price");
  assert.equal(exitsParsed.rules[0]?.tpsl?.tpTrigger, "last");
  assert.equal(exitsParsed.rules[0]?.tpsl?.slTrigger, "mark");
}

const emptyStop = new FormData();
emptyStop.set("ruleCount", "1");
emptyStop.set("r0_name", "Stop only");
emptyStop.set("r0_mode", "active");
emptyStop.set("r0_symbol", "BTCUSDT");
emptyStop.set("r0_action", "buy");
emptyStop.set("r0_orderType", "market");
emptyStop.set("r0_sizeUnit", "qty");
emptyStop.set("r0_size", "0.01");
emptyStop.set("r0_triggerBy", "last");
emptyStop.set("r0_triggerCompare", "gte");
emptyStop.set("r0_triggerPrice", "90000");
emptyStop.set("r0_tpsl", "on");
emptyStop.set("r0_slOn", "on");
emptyStop.set("r0_stopLoss", "");
emptyStop.set("r0_slTrigger", "last");
emptyStop.set("r0_tpTrigger", "last");
const emptyStopParsed = parseFuturesAutomationForm(emptyStop);
assert.equal(emptyStopParsed.ok, false);
if (!emptyStopParsed.ok) {
  assert.equal(emptyStopParsed.error, "Enter a stop loss.");
}

const percentExits = new FormData();
percentExits.set("ruleCount", "1");
percentExits.set("r0_name", "Pct");
percentExits.set("r0_mode", "active");
percentExits.set("r0_symbol", "BTCUSDT");
percentExits.set("r0_action", "buy");
percentExits.set("r0_orderType", "market");
percentExits.set("r0_sizeUnit", "qty");
percentExits.set("r0_size", "0.01");
percentExits.set("r0_triggerBy", "last");
percentExits.set("r0_triggerCompare", "gte");
percentExits.set("r0_triggerPrice", "90000");
percentExits.set("r0_tpsl", "on");
percentExits.set("r0_tpKind", "percent");
percentExits.set("r0_slKind", "percent");
percentExits.set("r0_takeProfit", "2");
percentExits.set("r0_stopLoss", "1");
percentExits.set("r0_tpslMode", "full");
const percentExitsParsed = parseFuturesAutomationForm(percentExits);
assert.equal(percentExitsParsed.ok, true);
if (percentExitsParsed.ok) {
  assert.equal(percentExitsParsed.rules[0]?.tpsl?.tpKind, "percent");
  assert.equal(percentExitsParsed.rules[0]?.tpsl?.takeProfit, 2);
  assert.equal(percentExitsParsed.rules[0]?.tpsl?.slKind, "percent");
  assert.equal(percentExitsParsed.rules[0]?.tpsl?.stopLoss, 1);
}

const close = new FormData();
close.set("ruleCount", "1");
close.set("r0_name", "Stop");
close.set("r0_symbol", "ETHUSDT");
close.set("r0_action", "close_short");
close.set("r0_orderType", "market");
close.set("r0_sizeUnit", "qty");
close.set("r0_triggerBy", "mark");
close.set("r0_triggerCompare", "lte");
close.set("r0_triggerPrice", "2000");
const closeParsed = parseFuturesAutomationForm(close);
assert.equal(closeParsed.ok, true);
if (closeParsed.ok) {
  assert.equal(closeParsed.rules[0]?.action, "flatten");
  assert.equal(closeParsed.rules[0]?.closeSide, "short");
  assert.equal(closeParsed.rules[0]?.size, null);
}

const missingSize = new FormData();
missingSize.set("ruleCount", "1");
missingSize.set("r0_symbol", "BTCUSDT");
missingSize.set("r0_action", "buy");
missingSize.set("r0_triggerPrice", "1");
assert.equal(parseFuturesAutomationForm(missingSize).ok, false);

const blank = parseFuturesAutomationForm(new FormData());
assert.equal(blank.ok, true);
if (blank.ok) {
  assert.equal(blank.rules.length, 0);
}

const hlRule = new FormData();
hlRule.set("deskVenue", "hyperliquid");
hlRule.set("ruleCount", "1");
hlRule.set("r0_name", "HL breakout");
hlRule.set("r0_symbol", "BTC");
hlRule.set("r0_action", "buy");
hlRule.set("r0_orderType", "market");
hlRule.set("r0_sizeUnit", "qty");
hlRule.set("r0_size", "0.01");
hlRule.set("r0_triggerBy", "last");
hlRule.set("r0_triggerCompare", "gte");
hlRule.set("r0_triggerPrice", "90000");
const hlParsed = parseFuturesAutomationForm(hlRule, "hyperliquid");
assert.equal(hlParsed.ok, true);
if (hlParsed.ok) {
  assert.equal(hlParsed.rules[0]?.symbol, "BTC");
}

assert.equal(defaultFuturesAutomationForm(0).formAction, "buy");
assert.equal(defaultFuturesAutomationForm(0).mode, "disabled");
assert.equal(defaultFuturesAutomationForm(0).sizeUnit, "usdt");

const webhookRule = new FormData();
webhookRule.set("ruleCount", "1");
webhookRule.set("r0_name", "TV start");
webhookRule.set("r0_symbol", "BTCUSDT");
webhookRule.set("r0_action", "buy");
webhookRule.set("r0_size", "0.01");
webhookRule.set("r0_entrySource", "webhook");
webhookRule.set("r0_webhookId", "11111111-1111-1111-1111-111111111111");
const webhookParsed = parseFuturesAutomationForm(webhookRule);
assert.equal(webhookParsed.ok, true);
if (webhookParsed.ok) {
  assert.equal(webhookParsed.rules[0]?.entrySource, "webhook");
  assert.equal(
    webhookParsed.rules[0]?.webhookId,
    "11111111-1111-1111-1111-111111111111",
  );
}

const indicatorRule = new FormData();
indicatorRule.set("ruleCount", "1");
indicatorRule.set("r0_name", "RSI long");
indicatorRule.set("r0_symbol", "BTCUSDT");
indicatorRule.set("r0_action", "buy");
indicatorRule.set("r0_orderType", "market");
indicatorRule.set("r0_size", "0.01");
indicatorRule.set("r0_entrySource", "indicator");
indicatorRule.set("r0_indicatorKind", "rsi");
indicatorRule.set("r0_indicatorTimeframe", "15");
indicatorRule.set("r0_indicatorCompare", "cross_lte");
indicatorRule.set("r0_indicatorLevel", "30");
indicatorRule.set("r0_indicatorPeriod", "14");
indicatorRule.set("r0_confirmKind", "ema");
indicatorRule.set("r0_confirmTimeframe", "240");
indicatorRule.set("r0_confirmCompare", "gte");
indicatorRule.set("r0_confirmPeriod", "20");
indicatorRule.set("r0_breakevenActivationPct", "2");
indicatorRule.set("r0_breakevenOffsetPct", "0");
const indicatorParsed = parseFuturesAutomationForm(indicatorRule);
assert.equal(indicatorParsed.ok, true);
if (indicatorParsed.ok) {
  assert.equal(indicatorParsed.rules[0]?.entrySource, "indicator");
  assert.equal(indicatorParsed.rules[0]?.indicator?.kind, "rsi");
  assert.equal(indicatorParsed.rules[0]?.confirm?.kind, "ema");
  assert.equal(indicatorParsed.rules[0]?.breakevenActivationPct, 2);
}

assert.deepEqual(
  futuresDeskAutomationStatus({
    signedIn: true,
    modes: ["active"],
    reduceOnly: false,
    liveBook: true,
    bound: true,
  }),
  { automationsRunning: true, reduceOnly: false },
);
assert.deepEqual(
  futuresDeskAutomationStatus({
    signedIn: true,
    modes: ["active"],
    reduceOnly: true,
    liveBook: true,
    bound: true,
  }),
  { automationsRunning: false, reduceOnly: true },
);
assert.deepEqual(
  futuresDeskAutomationStatus({
    signedIn: true,
    modes: ["reduce_only"],
    reduceOnly: false,
    liveBook: false,
    bound: false,
  }),
  { automationsRunning: false, reduceOnly: true },
);
assert.deepEqual(
  futuresDeskAutomationStatus({
    signedIn: true,
    modes: ["active"],
    reduceOnly: false,
    liveBook: true,
    bound: false,
  }),
  { automationsRunning: false, reduceOnly: false },
);
assert.deepEqual(
  futuresDeskAutomationStatus({
    signedIn: true,
    modes: [],
    reduceOnly: true,
    liveBook: true,
    bound: true,
  }),
  { automationsRunning: false, reduceOnly: false },
);

assert.deepEqual(
  blockedFuturesRuleDeletes(["a", "b", "c"], ["b", "z"]),
  ["b"],
);
assert.deepEqual(blockedFuturesRuleDeletes(["a"], []), []);
assert.equal(
  FUTURES_RULE_IN_USE,
  "Cannot remove a rule that has an open position.",
);

assert.equal(copyFuturesRuleName("ETH bounce"), "ETH bounce (copy)");
assert.equal(copyFuturesRuleName("ETH bounce (copy)"), "ETH bounce (copy)");
assert.equal(copyFuturesRuleName("A".repeat(80)).length, 80);
assert.equal(copyFuturesRuleName("A".repeat(80)).endsWith(" (copy)"), true);
assert.equal(copyFuturesRuleName("A".repeat(40)), `${"A".repeat(40)} (copy)`);
const cloneSource = {
  ...defaultFuturesAutomationForm(0, "ETHUSDT"),
  id: "rule-1",
  key: "rule-1",
  name: "ETH bounce",
  size: "0.5",
  formAction: "sell" as const,
};
const clonedRule = cloneFuturesAutomationForm(cloneSource);
assert.equal(clonedRule.id, "");
assert.equal(clonedRule.name, "ETH bounce (copy)");
assert.notEqual(clonedRule.key, cloneSource.key);
assert.equal(clonedRule.symbol, "ETHUSDT");
assert.equal(clonedRule.size, "0.5");
assert.equal(clonedRule.formAction, "sell");
assert.equal(clonedRule.mode, "disabled");

function perpsForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  form.set("deskVenue", "bybit");
  form.set("ruleCount", "1");
  form.set("r0_name", "Direction");
  form.set("r0_mode", "disabled");
  form.set("r0_symbol", "BTCUSDT");
  form.set("r0_orderType", "market");
  form.set("r0_sizeUnit", "qty");
  form.set("r0_size", "1");
  form.set("r0_entrySource", "price");
  form.set("r0_triggerBy", "last");
  form.set("r0_triggerCompare", "gte");
  form.set("r0_triggerPrice", "100");
  form.set("r0_skipIfOpen", "on");
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return form;
}

const derivedShort = parseFuturesAutomationForm(
  perpsForm({ r0_action: "sell" }),
);
assert.equal(derivedShort.ok, true);
if (derivedShort.ok) {
  assert.equal(derivedShort.rules[0]?.direction, "short");
  assert.equal(derivedShort.rules[0]?.action, "sell");
  assert.equal(derivedShort.rules[0]?.shortEntry, null);
}

const both = parseFuturesAutomationForm(
  perpsForm({
    r0_action: "buy",
    r0_direction: "both",
    r0_short_entrySource: "price",
    r0_short_triggerBy: "mark",
    r0_short_triggerCompare: "lte",
    r0_short_triggerPrice: "90",
    r0_short_skipIfOpen: "on",
  }),
);
assert.equal(both.ok, true);
if (both.ok) {
  const rule = both.rules[0];
  assert.equal(rule?.direction, "both");
  assert.equal(rule?.action, "buy");
  assert.equal(rule?.shortEntry?.triggerCompare, "lte");
  assert.equal(rule?.shortEntry?.triggerPrice, 90);
  assert.equal(rule?.shortEntry?.triggerBy, "mark");
  const row = futuresAutomationToRow("user", "account", rule!);
  assert.equal(row.direction, "both");
  const loaded = parseFuturesAutomationRow(row);
  assert.equal(loaded.direction, "both");
  assert.equal(loaded.shortEntry?.triggerPrice, 90);
  assert.equal(loaded.action, "buy");
}

const bothSized = parseFuturesAutomationForm(
  perpsForm({
    r0_action: "buy",
    r0_direction: "both",
    r0_size: "2",
    r0_sizeUnit: "usdt",
    r0_orderType: "market",
    r0_short_entrySource: "price",
    r0_short_triggerBy: "mark",
    r0_short_triggerCompare: "lte",
    r0_short_triggerPrice: "90",
    r0_short_size: "5",
    r0_short_sizeUnit: "qty",
    r0_short_orderType: "limit",
    r0_short_limitPrice: "80",
  }),
);
assert.equal(bothSized.ok, true);
if (bothSized.ok) {
  const rule = bothSized.rules[0];
  assert.equal(rule?.size, 2);
  assert.equal(rule?.sizeUnit, "usdt");
  assert.equal(rule?.shortEntry?.size, 5);
  assert.equal(rule?.shortEntry?.sizeUnit, "qty");
  assert.equal(rule?.shortEntry?.orderType, "limit");
  assert.equal(rule?.shortEntry?.limitPrice, 80);
  const legs = perpsAutomationLegs(rule!);
  assert.equal(legs[1]?.rule.size, 5);
  assert.equal(legs[1]?.rule.sizeUnit, "qty");
  assert.equal(legs[1]?.rule.orderType, "limit");
  assert.equal(legs[1]?.rule.limitPrice, 80);
  assert.equal(legs[0]?.rule.size, 2);
  const loaded = parseFuturesAutomationRow(
    futuresAutomationToRow("user", "account", rule!),
  );
  assert.equal(loaded.size, 2);
  assert.equal(loaded.shortEntry?.size, 5);
  assert.equal(loaded.shortEntry?.limitPrice, 80);
}

const bothSameSize = parseFuturesAutomationForm(
  perpsForm({
    r0_action: "buy",
    r0_direction: "both",
    r0_short_entrySource: "price",
    r0_short_triggerBy: "last",
    r0_short_triggerCompare: "lte",
    r0_short_triggerPrice: "90",
    r0_short_size: "1",
    r0_short_sizeUnit: "qty",
    r0_short_orderType: "market",
  }),
);
const bothRetrace = parseFuturesAutomationForm(
  perpsForm({
    r0_action: "buy",
    r0_direction: "both",
    r0_short_entrySource: "retrace",
    r0_short_RetraceSource: "last",
    r0_short_RetraceFrom: "low",
    r0_short_RetracePct: "2",
    r0_short_RetraceLookback: "20",
    r0_short_RetraceTimeframe: "60",
    r0_exitActions: JSON.stringify([
      {
        id: "long-tp",
        kind: "take_profit",
        scope: { kind: "all" },
        groups: [],
        takeProfitPct: 6,
      },
    ]),
    r0_short_exitActions: JSON.stringify([
      {
        id: "short-sl",
        kind: "stop_loss",
        scope: { kind: "all" },
        groups: [],
        stopLossPct: 2,
      },
    ]),
  }),
);
assert.equal(bothRetrace.ok, true);
if (bothRetrace.ok) {
  const legs = perpsAutomationLegs(bothRetrace.rules[0]!);
  assert.equal(legs[1]?.rule.entrySource, "retrace");
  assert.equal(legs[1]?.rule.retrace?.pct, 2);
  assert.equal(legs[1]?.rule.retrace?.from, "low");
  assert.equal(legs[1]?.rule.exitActions?.[0]?.id, "short-sl");
  assert.equal(legs[0]?.rule.exitActions?.[0]?.id, "long-tp");
}

const percentTrail = parseFuturesAutomationForm(
  perpsForm({
    r0_action: "buy",
    r0_trailing: "on",
    r0_trailingStop: "2",
    r0_trailingActiveKind: "percent",
    r0_trailingTriggerPct: "6",
    r0_exitActions: JSON.stringify([
      {
        id: "trail",
        kind: "trailing_stop",
        scope: { kind: "all" },
        groups: [],
        trailingPct: 2,
        trailingTriggerPct: 6,
      },
    ]),
  }),
);
assert.equal(percentTrail.ok, true);
if (percentTrail.ok) {
  assert.equal(percentTrail.rules[0]?.exitActions?.[0]?.trailingPct, 2);
  assert.equal(percentTrail.rules[0]?.exitActions?.[0]?.trailingTriggerPct, 6);
}
const percentTrailAsPrice = parseFuturesAutomationForm(
  perpsForm({
    r0_action: "buy",
    r0_trailing: "on",
    r0_trailingStop: "2",
    r0_trailingTriggerPct: "6",
  }),
);
assert.equal(percentTrailAsPrice.ok, false);
if (!percentTrailAsPrice.ok) {
  assert.equal(percentTrailAsPrice.error, "Enter an activation price.");
}

assert.equal(bothSameSize.ok, true);
if (bothSameSize.ok) {
  assert.equal(bothSameSize.rules[0]?.shortEntry?.size, undefined);
  assert.equal(perpsAutomationLegs(bothSameSize.rules[0]!)[1]?.rule.size, 1);
}

const oneWay = parseFuturesAutomationForm(
  perpsForm({
    deskVenue: "hyperliquid",
    r0_symbol: "BTC",
    r0_action: "buy",
    r0_direction: "both",
  }),
  "hyperliquid",
);
assert.equal(oneWay.ok, false);
if (!oneWay.ok) {
  assert.match(oneWay.error, /one-way/);
}

const blankTrigger = parseFuturesAutomationForm(
  perpsForm({ r0_action: "buy", r0_entrySource: "" }),
);
assert.equal(blankTrigger.ok, false);
if (!blankTrigger.ok) {
  assert.match(blankTrigger.error, /Choose a trigger/);
}

console.log("futures automation checks passed");
