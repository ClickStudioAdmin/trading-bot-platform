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
  parseFuturesAutomationForm,
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

assert.equal(defaultFuturesAutomationForm(0).formAction, "buy");

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
assert.equal(copyFuturesRuleName("A".repeat(40)).length, 40);
assert.equal(copyFuturesRuleName("A".repeat(40)).endsWith(" (copy)"), true);
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
assert.equal(clonedRule.mode, "active");

console.log("futures automation checks passed");
