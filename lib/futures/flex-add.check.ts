import assert from "node:assert/strict";
import {
  futuresAutomationToRow,
  parseFuturesAutomationForm,
  parseFuturesAutomationRow,
  perpsAutomationLegs,
  perpsRuleMatchesWebhook,
} from "@/lib/futures/automation";
import { flexAddDecision, flexAddLatchColumn } from "@/lib/futures/flex-add";
import { addStackMatchesWebhook } from "@/lib/strategy/expr";
import type { EntryStack } from "@/lib/strategy/expr";

const bars = new Map();

const priceAdd: EntryStack = {
  leaves: [{ kind: "price", triggerBy: "last", compare: "lte", price: 90 }],
  joins: ["and"],
  orders: [{ size: "500", sizeUnit: "usdt", orderType: "market", limitPrice: "" }],
};

const first = flexAddDecision({
  stack: priceAdd,
  side: "long",
  price: 88,
  barsByTimeframe: bars,
  wasTrue: false,
  open: true,
});
assert.equal(first.fire, true);
assert.equal(first.met, true);
assert.equal(first.order?.size, "500");
assert.equal(first.order?.sizeUnit, "usdt");

const held = flexAddDecision({
  stack: priceAdd,
  side: "long",
  price: 87,
  barsByTimeframe: bars,
  wasTrue: true,
  open: true,
});
assert.equal(held.fire, false);
assert.equal(held.met, true);

const recovered = flexAddDecision({
  stack: priceAdd,
  side: "long",
  price: 95,
  barsByTimeframe: bars,
  wasTrue: true,
  open: true,
});
assert.equal(recovered.met, false);
assert.equal(recovered.nextTrue, false);

const again = flexAddDecision({
  stack: priceAdd,
  side: "long",
  price: 89,
  barsByTimeframe: bars,
  wasTrue: false,
  open: true,
});
assert.equal(again.fire, true);

const flat = flexAddDecision({
  stack: priceAdd,
  side: "long",
  price: 80,
  barsByTimeframe: bars,
  wasTrue: true,
  open: false,
});
assert.equal(flat.fire, false);
assert.equal(flat.nextTrue, false);

const noSize = flexAddDecision({
  stack: {
    ...priceAdd,
    orders: [{ size: "", sizeUnit: "usdt", orderType: "market", limitPrice: "" }],
  },
  side: "long",
  price: 80,
  barsByTimeframe: bars,
  wasTrue: false,
  open: true,
});
assert.equal(noSize.fire, false);
assert.equal(noSize.met, true);

const limitMissing = flexAddDecision({
  stack: {
    ...priceAdd,
    orders: [{ size: "2", sizeUnit: "qty", orderType: "limit", limitPrice: "" }],
  },
  side: "short",
  price: 80,
  barsByTimeframe: bars,
  wasTrue: false,
  open: true,
});
assert.equal(limitMissing.fire, false);

const webhookAdd: EntryStack = {
  leaves: [{ kind: "webhook", webhookId: "hook-1" }],
  joins: ["and"],
  orders: [{ size: "1", sizeUnit: "qty", orderType: "market", limitPrice: "" }],
};
assert.equal(addStackMatchesWebhook(webhookAdd, "hook-1"), true);
assert.equal(addStackMatchesWebhook(webhookAdd, "other"), false);
assert.equal(addStackMatchesWebhook(priceAdd, "hook-1"), false);

const onSignal = flexAddDecision({
  stack: webhookAdd,
  side: "short",
  price: 100,
  barsByTimeframe: bars,
  wasTrue: false,
  open: true,
  firedWebhookId: "hook-1",
});
assert.equal(onSignal.fire, true);
const priceTick = flexAddDecision({
  stack: webhookAdd,
  side: "short",
  price: 100,
  barsByTimeframe: bars,
  wasTrue: false,
  open: true,
});
assert.equal(priceTick.met, false);
assert.equal(priceTick.fire, false);

const protectedAdd: EntryStack = {
  leaves: [{ kind: "protection", is: "protected", amount: "entire", pct: null }],
  joins: ["and"],
  orders: [{ size: "1", sizeUnit: "qty", orderType: "market", limitPrice: "" }],
};
assert.equal(
  flexAddDecision({
    stack: protectedAdd,
    side: "long",
    price: 100,
    barsByTimeframe: bars,
    wasTrue: false,
    open: true,
    protection: { openQty: 2, provenPct: 100 },
  }).fire,
  true,
);
assert.equal(
  flexAddDecision({
    stack: protectedAdd,
    side: "long",
    price: 100,
    barsByTimeframe: bars,
    wasTrue: false,
    open: true,
    protection: { openQty: 2, provenPct: 40 },
  }).fire,
  false,
);

assert.equal(flexAddLatchColumn("condition_true"), "add_condition_true");
assert.equal(
  flexAddLatchColumn("short_condition_true"),
  "short_add_condition_true",
);

function perpsForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  form.set("ruleCount", "1");
  form.set("r0_name", "Bot");
  form.set("r0_mode", "active");
  form.set("r0_symbol", "SOLUSDT");
  form.set("r0_action", "buy");
  form.set("r0_orderType", "market");
  form.set("r0_sizeUnit", "usdt");
  form.set("r0_size", "100");
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

const saved = parseFuturesAutomationForm(
  perpsForm({
    r0_direction: "both",
    r0_addExpr: JSON.stringify(priceAdd),
    r0_short_entrySource: "webhook",
    r0_short_webhookId: "entry-hook",
    r0_short_triggerBy: "last",
    r0_short_triggerCompare: "lte",
    r0_short_triggerPrice: "1",
    r0_short_skipIfOpen: "on",
    r0_short_addExpr: JSON.stringify(webhookAdd),
  }),
);
assert.equal(saved.ok, true);
if (saved.ok) {
  const rule = saved.rules[0]!;
  const row = futuresAutomationToRow("user", "account", rule);
  assert.equal(row.add_condition_true, false);
  assert.equal(row.short_add_condition_true, false);
  const loaded = parseFuturesAutomationRow({
    ...row,
    add_condition_true: true,
    short_add_condition_true: false,
  });
  assert.equal(loaded.addConditionTrue, true);
  assert.equal(loaded.shortAddConditionTrue, false);
  assert.equal(loaded.addStack?.orders?.[0]?.size, "500");
  const legs = perpsAutomationLegs(loaded);
  assert.equal(legs[0]?.rule.addConditionTrue, true);
  assert.equal(legs[1]?.rule.addConditionTrue, false);
  assert.equal(legs[1]?.rule.addStack?.leaves[0]?.kind, "webhook");
  assert.equal(perpsRuleMatchesWebhook(loaded, "hook-1"), true);
  assert.equal(perpsRuleMatchesWebhook(loaded, "missing"), false);
  assert.equal(
    addStackMatchesWebhook(legs[1]?.rule.addStack, "hook-1"),
    true,
  );
}

console.log("flex add engine checks passed");
