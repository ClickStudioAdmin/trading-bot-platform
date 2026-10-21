import assert from "node:assert/strict";
import {
  futuresAutomationToRow,
  parseFuturesAutomationForm,
  parseFuturesAutomationRow,
  perpsAutomationLegs,
  perpsRuleMatchesWebhook,
} from "@/lib/futures/automation";
import { flexAddDecision, flexAddLatchColumn } from "@/lib/futures/flex-add";
import {
  addStackMatchesWebhook,
  emptyEntryStack,
  entryExprMetaFromJson,
  entryExprToJson,
  type EntryStack,
} from "@/lib/strategy/expr";
import {
  formatProtectionLabel,
  parseProtectionSpec,
  protectionMet,
} from "@/lib/strategy/protection";
import {
  commitPositionRetraceFire,
  emptyPositionRetraceMemory,
  positionRetraceMet,
  positionRetraceToJson,
  resumePositionRetrace,
} from "@/lib/strategy/retrace";

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
    protection: { openQty: 2, provenPct: 100, noLossProvenPct: 0 },
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
    protection: { openQty: 2, provenPct: 40, noLossProvenPct: 40 },
  }).fire,
  false,
);
const noLossAdd: EntryStack = {
  leaves: [{ kind: "protection", is: "no_loss", amount: "entire", pct: null }],
  joins: ["and"],
  orders: [{ size: "1", sizeUnit: "qty", orderType: "market", limitPrice: "" }],
};
assert.equal(
  flexAddDecision({
    stack: noLossAdd,
    side: "long",
    price: 100,
    barsByTimeframe: bars,
    wasTrue: false,
    open: true,
    protection: { openQty: 2, provenPct: 100, noLossProvenPct: 0 },
  }).fire,
  false,
);
assert.equal(
  flexAddDecision({
    stack: noLossAdd,
    side: "short",
    price: 100,
    barsByTimeframe: bars,
    wasTrue: false,
    open: true,
    protection: { openQty: 2, provenPct: 100, noLossProvenPct: 100 },
  }).because,
  "Protected - No Loss, entire position",
);
assert.equal(
  protectionMet({
    spec: { is: "protected", amount: "entire", pct: null },
    openQty: 2,
    provenPct: 100,
    noLossProvenPct: 0,
  }),
  true,
);
assert.equal(
  protectionMet({
    spec: { is: "no_loss", amount: "entire", pct: null },
    openQty: 2,
    provenPct: 100,
    noLossProvenPct: 0,
  }),
  false,
);
assert.equal(
  protectionMet({
    spec: { is: "no_loss", amount: "at_least", pct: 40 },
    openQty: 2,
    provenPct: 100,
    noLossProvenPct: 40,
  }),
  true,
);
assert.equal(parseProtectionSpec({ is: "unprotected", amount: "entire" }), null);
assert.equal(
  formatProtectionLabel({ is: "no_loss", amount: "entire", pct: null }),
  "Protected - No Loss, entire position",
);
const savedNoLoss = entryExprToJson(emptyEntryStack(), {
  add: {
    leaves: [{ kind: "protection", is: "no_loss", amount: "at_least", pct: 40 }],
    joins: ["and"],
  },
});
const savedLeaf = entryExprMetaFromJson(savedNoLoss).add?.leaves[0];
assert.equal(savedLeaf?.kind, "protection");
if (savedLeaf?.kind === "protection") {
  assert.equal(savedLeaf.is, "no_loss");
  assert.equal(savedLeaf.pct, 40);
}
assert.equal(
  entryExprMetaFromJson({
    leaves: [],
    joins: [],
    add: {
      leaves: [{ kind: "protection", is: "unprotected", amount: "entire", pct: null }],
      joins: ["and"],
    },
  }).add,
  null,
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

const longMemory = emptyPositionRetraceMemory(100, "pos-long");
const shortMemory = resumePositionRetrace({
  stored: null,
  positionKey: "pos-short",
  initial: 90,
  quotes: { last: 80, mark: 80, index: 80 },
  wick: { high: 91, low: 79 },
})!;
assert.equal(shortMemory.high.last, 91);
assert.equal(shortMemory.low.last, 79);
assert.equal(shortMemory.initial, 90);

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
  assert.equal(row.add_retrace, null);
  assert.equal(row.short_add_retrace, null);
  const loaded = parseFuturesAutomationRow({
    ...row,
    add_condition_true: true,
    short_add_condition_true: false,
    add_retrace: positionRetraceToJson(longMemory),
    short_add_retrace: positionRetraceToJson(shortMemory),
  });
  assert.equal(loaded.addConditionTrue, true);
  assert.equal(loaded.shortAddConditionTrue, false);
  assert.equal(loaded.addRetrace?.initial, 100);
  assert.equal(loaded.shortAddRetrace?.high.last, 91);
  assert.equal(loaded.shortAddRetrace?.low.last, 79);
  assert.equal(loaded.addStack?.orders?.[0]?.size, "500");
  const legs = perpsAutomationLegs(loaded);
  assert.equal(legs[0]?.rule.addConditionTrue, true);
  assert.equal(legs[0]?.rule.addRetrace?.positionKey, "pos-long");
  assert.equal(legs[1]?.rule.addConditionTrue, false);
  assert.equal(legs[1]?.rule.addRetrace?.positionKey, "pos-short");
  assert.equal(legs[1]?.rule.addStack?.leaves[0]?.kind, "webhook");
  assert.equal(perpsRuleMatchesWebhook(loaded, "hook-1"), true);
  assert.equal(perpsRuleMatchesWebhook(loaded, "missing"), false);
  assert.equal(
    addStackMatchesWebhook(legs[1]?.rule.addStack, "hook-1"),
    true,
  );
}

const highStack: EntryStack = {
  leaves: [{ kind: "retrace", source: "last", from: "high", pct: 1 }],
  joins: ["and"],
  orders: [{ size: "1", sizeUnit: "qty", orderType: "market", limitPrice: "" }],
};
function highDecision(
  memory: NonNullable<typeof longMemory>,
  price: number,
  wasTrue: boolean,
) {
  return flexAddDecision({
    stack: highStack,
    side: "long",
    price,
    prices: { last: price, mark: price, index: price },
    barsByTimeframe: bars,
    wasTrue,
    open: true,
    positionRetrace: { average: 100, memory },
  });
}
const armedHigh = resumePositionRetrace({
  stored: longMemory,
  positionKey: "pos-long",
  initial: 100,
  quotes: { last: 99 },
})!;
assert.equal(armedHigh.high.last, 100);
const firstHigh = highDecision(armedHigh, 99, false);
assert.equal(firstHigh.fire, true);
assert.match(firstHigh.because, /high since entry/);
const heldHigh = commitPositionRetraceFire(armedHigh, highStack.leaves);
assert.equal(highDecision(heldHigh, 90, false).met, false);
const newHigh = resumePositionRetrace({
  stored: heldHigh,
  positionKey: "pos-long",
  initial: 100,
  quotes: { last: 102 },
  wick: { high: 102, low: 102 },
})!;
assert.equal(highDecision(newHigh, 102, false).met, false);
const pulled = resumePositionRetrace({
  stored: newHigh,
  positionKey: "pos-long",
  initial: 100,
  quotes: { last: 100.98 },
})!;
assert.equal(highDecision(pulled, 100.98, false).fire, true);
const sameBar = resumePositionRetrace({
  stored: heldHigh,
  positionKey: "pos-long",
  initial: 100,
  quotes: { last: 100.9 },
  wick: { high: 102, low: 100.9 },
})!;
assert.equal(positionRetraceMet({
  spec: { source: "last", from: "high", pct: 1 },
  side: "long",
  price: 100.9,
  average: 100,
  memory: sameBar,
}), true);

const initialStack: EntryStack = {
  leaves: [{ kind: "retrace", source: "last", from: "initial", pct: 1 }],
  joins: ["and"],
  orders: [{ size: "1", sizeUnit: "qty", orderType: "market", limitPrice: "" }],
};
let initialMemory = emptyPositionRetraceMemory(100, "pos-long");
assert.equal(
  flexAddDecision({
    stack: initialStack,
    side: "long",
    price: 99,
    prices: { last: 99, mark: 99, index: 99 },
    barsByTimeframe: bars,
    wasTrue: false,
    open: true,
    positionRetrace: { average: 100, memory: initialMemory },
  }).fire,
  true,
);
initialMemory = commitPositionRetraceFire(initialMemory, initialStack.leaves);
assert.equal(
  flexAddDecision({
    stack: initialStack,
    side: "short",
    price: 110,
    prices: { last: 98, mark: 98, index: 98 },
    barsByTimeframe: bars,
    wasTrue: false,
    open: true,
    positionRetrace: { average: 100, memory: initialMemory },
  }).met,
  false,
);
assert.equal(
  positionRetraceMet({
    spec: { source: "last", from: "initial", pct: 1 },
    side: "short",
    price: 101,
    average: 100,
    memory: emptyPositionRetraceMemory(100, "short"),
  }),
  true,
);

const averageStack: EntryStack = {
  ...initialStack,
  leaves: [{ kind: "retrace", source: "last", from: "average", pct: 1 }],
};
assert.equal(
  positionRetraceMet({
    spec: { source: "last", from: "average", pct: 1 },
    side: "long",
    price: 99,
    average: 99.5,
    memory: emptyPositionRetraceMemory(100, "pos-long"),
  }),
  false,
);
assert.equal(
  flexAddDecision({
    stack: averageStack,
    side: "long",
    price: 98.5,
    prices: { last: 98.5, mark: 98.5, index: 98.5 },
    barsByTimeframe: bars,
    wasTrue: false,
    open: true,
    positionRetrace: {
      average: 99.5,
      memory: emptyPositionRetraceMemory(100, "pos-long"),
    },
  }).fire,
  true,
);
const blocked = flexAddDecision({
  stack: {
    leaves: [
      { kind: "retrace", source: "last", from: "high", pct: 1 },
      { kind: "price", triggerBy: "last", compare: "lte", price: 50 },
    ],
    joins: ["and", "and"],
    orders: highStack.orders,
  },
  side: "long",
  price: 99,
  prices: { last: 99, mark: 99, index: 99 },
  barsByTimeframe: bars,
  wasTrue: false,
  open: true,
  positionRetrace: { average: 100, memory: armedHigh },
});
assert.equal(blocked.fire, false);
assert.equal(commitPositionRetraceFire(armedHigh, []).highAnchor.last, null);

console.log("flex add engine checks passed");
