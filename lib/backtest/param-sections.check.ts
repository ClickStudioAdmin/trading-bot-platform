import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { defaultPaperLayer } from "@/lib/engine/rules";
import {
  snapshotDcaRecipe,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
} from "@/lib/templates/recipe";
import { adminConditionReview } from "./condition-list-samples";
import {
  backtestListedSections,
  recipeParamRows,
  recipeParamSections,
  templateParamSections,
} from "./param-sections";

function dcaSeed() {
  const form = new FormData();
  form.set("name", "Study seed");
  form.set("symbol", "BTCUSDT");
  form.set("direction", "long");
  form.set("startKind", "immediate");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  form.set("takeProfitPct", "10");
  const parsed = parseDcaPlaybookForm(form);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("expected DCA parse");
  }
  return snapshotDcaRecipe(parsed.config);
}

const dca = dcaSeed();
const sections = recipeParamSections(dca);
assert.deepEqual(
  sections.map((section) => section.title),
  ["General", "Long Entry Conditions", "Position Sizing", "Additional Orders", "Long Exit Conditions"],
);
const general = sections[0]?.groups[0]?.rows.map((row) => row.label);
assert.deepEqual(general, ["Name", "Contract", "Direction"]);
const exposure = sections[0]?.groups[1];
assert.equal(exposure?.title, "Maximum Exposure");
assert.deepEqual(
  exposure?.rows.map((row) => row.label),
  ["Max orders", "Max value"],
);
const sizing = sections[2]?.groups.map((group) => group.title);
assert.deepEqual(sizing, ["Initial Order Size"]);
const adds = sections[3]?.groups.map((group) => group.title);
assert.deepEqual(adds, ["Additional Order Types", "Additional Order Scaling"]);
const labels = recipeParamRows(dca).map((row) => row.label);
assert.equal(labels.includes("Type"), false);
assert.equal(labels.includes("Take profit"), false);
assert.ok(labels.includes("Basis"));
assert.ok(labels.includes("Target %"));
assert.equal(
  labels.includes("Trigger %"),
  false,
  "trailing fields stay hidden while Trailing stop is off",
);
assert.equal(
  recipeParamRows(dca).find((row) => row.label === "Trailing stop")?.value,
  "Off",
);
assert.equal(
  recipeParamRows(dca).find((row) => row.label === "Stop loss")?.value,
  "Off",
);
assert.equal(
  recipeParamRows(dca).some((row) => row.label === "Move Breakeven"),
  false,
);

function dcaWithExits(fields: Record<string, string>) {
  const form = new FormData();
  form.set("name", "Exit nest");
  form.set("symbol", "BTCUSDT");
  form.set("direction", "long");
  form.set("startKind", "immediate");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  form.set("takeProfitPct", "10");
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  const parsed = parseDcaPlaybookForm(form);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("expected DCA parse");
  }
  return snapshotDcaRecipe(parsed.config);
}

const nestedStop = recipeParamSections(
  dcaWithExits({
    stopLossPct: "3",
    breakevenActivationPct: "1.5",
    breakevenOffsetPct: "0.2",
  }),
).find((section) => section.title === "Long Exit Conditions");
const stopGroup = nestedStop?.groups.find((group) => group.title === "Stop loss");
assert.deepEqual(
  stopGroup?.rows.map((row) => row.label),
  ["Basis", "Stop loss %", "Move stop to breakeven at %", "Breakeven offset %"],
);
assert.equal(
  nestedStop?.groups.some((group) => group.title === "Move Breakeven"),
  false,
);
const breakevenOnly = recipeParamSections(
  dcaWithExits({ breakevenActivationPct: "1.5" }),
).find((section) => section.title === "Long Exit Conditions");
assert.deepEqual(
  breakevenOnly?.groups
    .find((group) => group.title === "Stop loss")
    ?.rows.map((row) => row.label),
  ["Move stop to breakeven at %", "Breakeven offset %"],
);
assert.equal(
  recipeParamRows(dca).find((row) => row.label === "Custom conditions")?.value,
  "Off",
);
const splitDca = recipeParamSections(
  dcaWithExits({
    direction: "both",
    takeProfitPct: "5",
    shortClassic: "on",
    shortTpOn: "on",
    shortTakeProfitKind: "percent",
    shortTakeProfitPct: "8",
    shortTakeProfitBasis: "average",
    shortTakeProfitOrderType: "market",
  }),
);
assert.equal(
  splitDca
    .find((section) => section.title === "Long Exit Conditions")
    ?.groups.find((group) => group.title === "Take profit")
    ?.rows.find((row) => row.label === "Target %")?.value,
  "5%",
);
assert.equal(
  splitDca
    .find((section) => section.title === "Short Exit Conditions")
    ?.groups.find((group) => group.title === "Take profit")
    ?.rows.find((row) => row.label === "Target %")?.value,
  "8%",
);

const listed = backtestListedSections(dca, {
  name: "October ETH",
  leverage: 10,
  startingUsdt: 10000,
  fromMs: Date.UTC(2021, 9, 2),
  toMs: Date.UTC(2024, 0, 1),
});
assert.equal(listed[0]?.title, "Market window");
assert.equal(listed[1]?.title, "General");
assert.deepEqual(
  listed[0]?.groups[0]?.rows.map((row) => row.label),
  ["Name", "Start date", "End date", "Initial account balance", "Leverage"],
);
assert.equal(listed[0]?.groups[0]?.rows[0]?.value, "October ETH");
assert.deepEqual(
  listed[1]?.groups[0]?.rows.map((row) => row.label),
  ["Contract", "Direction"],
);

const perps = snapshotPerpsRecipe({
  name: "Perps rule",
  symbol: "ETHUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "qty",
  size: 2,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 100,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
});
const perpsSections = recipeParamSections(perps);
assert.deepEqual(
  perpsSections.map((section) => section.title),
  ["General", "Long Entry Conditions", "Position Sizing", "Long Additional Orders", "Long Exit Conditions"],
);
assert.deepEqual(
  perpsSections
    .find((section) => section.title === "Long Additional Orders")
    ?.groups[0]?.rows.map((row) => `${row.label}: ${row.value}`),
  ["Condition Type: Off", "Size: Off", "Unit: Off", "Order: Off"],
);
assert.deepEqual(
  perpsSections[0]?.groups[0]?.rows.map((row) => row.label),
  ["Name", "Contract", "Direction"],
);
assert.equal(
  perpsSections[1]?.groups[0]?.rows[0]?.value,
  "Price cross",
);
assert.equal(
  recipeParamRows(perps).find((row) => row.label === "Secondary Entry Condition")
    ?.value,
  "Off",
);
const orRecipe = snapshotPerpsRecipe({
  name: "Or entry",
  symbol: "ETHUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "qty",
  size: 1,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 100,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
  confirm: null,
  entryStack: {
    leaves: [
      {
        kind: "filter",
        spec: {
          kind: "ema",
          timeframe: "60",
          compare: "gte",
          level: null,
          period: 21,
          multiplier: null,
        },
      },
    ],
    joins: ["or"],
  },
});
const orEntry = recipeParamSections(orRecipe).find(
  (section) => section.title === "Long Entry Conditions",
);
assert.equal(orEntry?.stack?.groups.length, 2);
assert.equal(orEntry?.stack?.groups[0]?.length, 1);
assert.equal(orEntry?.stack?.groups[1]?.length, 1);
assert.match(
  orEntry?.stack?.groups[1]?.[0]?.rows.map((row) => `${row.label} ${row.value}`).join(" ") ??
    "",
  /Price vs EMA/,
);
assert.match(
  orEntry?.stack?.groups[1]?.[0]?.rows.map((row) => row.value).join(" ") ?? "",
  /21/,
);
assert.equal(
  recipeParamRows(orRecipe).some((row) => row.label === "Secondary Entry Condition"),
  false,
);
assert.equal(
  recipeParamRows(perps).find((row) => row.label === "Take profit")?.value,
  "Off",
);
const closeRecipe = snapshotPerpsRecipe({
  name: "Close",
  symbol: "ETHUSDT",
  action: "flatten",
  closeSide: "long",
  orderType: "market",
  sizeUnit: "qty",
  size: null,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 1,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
});
assert.equal(
  recipeParamSections(closeRecipe).some(
    (section) =>
      section.title === "Exit Conditions" ||
      section.title.endsWith("Exit Conditions"),
  ),
  false,
);
assert.equal(
  recipeParamSections(closeRecipe).some((section) =>
    section.title.endsWith("Additional Orders"),
  ),
  false,
);
assert.equal(
  recipeParamRows(closeRecipe).find((row) => row.label === "Qty to close")?.value,
  "All",
);

const templateDca = templateParamSections(dca);
assert.deepEqual(
  templateDca[0]?.groups[0]?.rows.map((row) => row.label),
  ["Contract", "Direction"],
);
assert.equal(
  templateDca.flatMap((section) => section.groups.flatMap((group) => group.rows)).some(
    (row) => row.label === "Name",
  ),
  false,
);

const paper = snapshotPaperRecipe({
  ...defaultPaperLayer(0),
  name: "Core carry",
  sizeType: "fixed",
  exitSizeType: "fixed",
  notionalUsdt: 250,
  minNetApr: 0.1,
  minDte: 7,
  maxOpenCount: 2,
  stopLossPct: -0.02,
});
const paperSections = templateParamSections(paper);
assert.deepEqual(
  paperSections.map((section) => section.title),
  ["Entry Conditions", "Position Sizing", "Exit Conditions"],
);
const paperRows = paperSections.flatMap((section) =>
  section.groups.flatMap((group) => group.rows),
);
assert.equal(paperRows.find((row) => row.label === "Name"), undefined);
assert.equal(paperRows.find((row) => row.label === "Min APR %")?.value, "10%");
assert.equal(paperRows.find((row) => row.label === "Min DTE")?.value, "7");
assert.equal(paperRows.find((row) => row.label === "Max DTE")?.value, "Off");
assert.equal(
  paperRows.find((row) => row.label === "Order size (USDT)")?.value,
  "250",
);
assert.equal(
  paperRows.find((row) => row.label === "Take profit")?.value,
  "Off",
);
assert.equal(
  paperRows.find((row) => row.label === "Stop loss %")?.value,
  "2%",
);

const atrEntry = {
  ...perps,
  entrySource: "indicator" as const,
  indicator: {
    kind: "atr_band" as const,
    timeframe: "15" as const,
    compare: "inside" as const,
    level: null,
    period: 10,
    slowPeriod: null,
    multiplier: 2,
  },
};
const atrRows = recipeParamRows(atrEntry);
assert.equal(
  atrRows.find((row) => row.label === "Indicator")?.value,
  "ATR band",
);
assert.equal(
  atrRows.find((row) => row.label === "Multiplier")?.value,
  "2",
);

const bothSections = recipeParamSections({
  ...perps,
  direction: "both",
  entryStack: {
    leaves: [{ kind: "price", triggerBy: "last", compare: "gte", price: 130 }],
    joins: ["and"],
  },
  shortEntry: {
    entrySource: "price",
    webhookId: null,
    triggerBy: "last",
    triggerCompare: "lte",
    triggerPrice: 90,
    skipIfOpen: true,
    indicator: null,
    confirm: null,
    entryStack: {
      leaves: [{ kind: "price", triggerBy: "last", compare: "lte", price: 70 }],
      joins: ["or"],
    },
  },
});
assert.deepEqual(
  bothSections.map((section) => section.title),
  [
    "General",
    "Long Entry Conditions",
    "Short Entry Conditions",
    "Position Sizing",
    "Long Additional Orders",
    "Short Additional Orders",
    "Long Exit Conditions",
    "Short Exit Conditions",
  ],
);
assert.equal(
  bothSections.find((section) => section.title === "General")?.groups[0]?.rows.find(
    (row) => row.label === "Direction",
  )?.value,
  "Both",
);
const bothRows = recipeParamSections({
  ...perps,
  direction: "both",
  entryStack: {
    leaves: [{ kind: "price", triggerBy: "last", compare: "gte", price: 130 }],
    joins: ["and"],
  },
  shortEntry: {
    entrySource: "price",
    webhookId: null,
    triggerBy: "last",
    triggerCompare: "lte",
    triggerPrice: 90,
    skipIfOpen: true,
    indicator: null,
    confirm: null,
    entryStack: {
      leaves: [{ kind: "price", triggerBy: "last", compare: "lte", price: 70 }],
      joins: ["or"],
    },
  },
});
const bothShort = bothRows.find((section) => section.title === "Short Entry Conditions");
assert.equal(bothShort?.stack?.groups.length, 2);
assert.match(
  bothShort?.stack?.groups[1]?.[0]?.rows.map((row) => row.value).join(" ") ?? "",
  /70/,
);
const bothLong = bothRows.find((section) => section.title === "Long Entry Conditions");
assert.equal(bothLong?.stack?.groups.length, 1);
assert.equal(bothLong?.stack?.groups[0]?.length, 2);
const longTpsl = {
  takeProfit: 10,
  stopLoss: null,
  tpKind: "price" as const,
  slKind: "price" as const,
  tpTrigger: "last" as const,
  slTrigger: "last" as const,
  mode: "full" as const,
  tpQty: null,
  slQty: null,
  tpOrderType: "market" as const,
  slOrderType: "market" as const,
  tpLimitPrice: null,
  slLimitPrice: null,
};
const splitPerps = recipeParamSections(
  snapshotPerpsRecipe({
    name: "Perps rule",
    symbol: "ETHUSDT",
    action: "buy",
    closeSide: null,
    orderType: "market",
    sizeUnit: "qty",
    size: 2,
    limitPrice: null,
    entrySource: "price",
    triggerBy: "last",
    triggerCompare: "gte",
    triggerPrice: 100,
    skipIfOpen: true,
    trailing: null,
    direction: "both",
    tpsl: longTpsl,
    shortEntry: {
      entrySource: "price",
      webhookId: null,
      triggerBy: "last",
      triggerCompare: "lte",
      triggerPrice: 90,
      skipIfOpen: true,
      indicator: null,
      confirm: null,
      entryStack: { leaves: [], joins: [] },
      classic: {
        tpsl: { ...longTpsl, takeProfit: 7, tpTrigger: "index" },
        trailing: null,
        breakevenActivationPct: null,
        breakevenOffsetPct: null,
      },
    },
  }),
);
assert.equal(
  splitPerps
    .find((section) => section.title === "Long Exit Conditions")
    ?.groups.find((group) => group.title === "Take profit")
    ?.rows.find((row) => row.label === "Price")?.value,
  "10",
);
assert.equal(
  splitPerps
    .find((section) => section.title === "Short Exit Conditions")
    ?.groups.find((group) => group.title === "Take profit")
    ?.rows.find((row) => row.label === "Price")?.value,
  "7",
);

const review = adminConditionReview();
assert.deepEqual(
  review.map((sample) => sample.title),
  ["Two groups", "One group", "Custom exit", "Flex Or group"],
);
const two = review[0]?.sections[0];
assert.equal(two?.title, "Short Entry Conditions");
assert.equal(two?.stack?.groups.length, 2);
assert.equal(two?.stack?.groups[0]?.length, 2);
assert.equal(two?.stack?.groups[1]?.length, 1);
assert.equal(
  two?.stack?.groups[0]?.[0]?.rows.find((row) => row.label === "When")?.value,
  "Turns bearish",
);
assert.equal(
  two?.stack?.groups[0]?.[1]?.rows.find((row) => row.label === "Level")?.value,
  "70",
);
const one = review[1]?.sections[0];
assert.equal(one?.stack?.groups.length, 1);
assert.equal(one?.stack?.groups[0]?.length, 2);
const exitSample = review[2]?.sections[0];
assert.equal(exitSample?.title, "Short Exit Conditions");
assert.equal(
  exitSample?.groups.some((group) => group.title === "Take profit"),
  true,
);
assert.equal(exitSample?.stack?.title, "Custom conditions");
assert.equal(exitSample?.stack?.groups.length, 2);
assert.equal(exitSample?.stack?.groups[0]?.length, 2);
const perpsOr = review[3]?.sections[0];
assert.equal(perpsOr?.stack?.groups.length, 2);
assert.equal(perpsOr?.stack?.groups[0]?.length, 1);

const actionCards = recipeParamSections(
  dcaWithExits({
    exitActions: JSON.stringify([
      {
        id: "harvest",
        kind: "close",
        scope: { kind: "fills", minProfitPct: 20 },
        groups: [],
        takeProfitPct: null,
        takeProfitPrice: null,
        stopLossPct: null,
        stopLossPrice: null,
        trailingDistance: null,
        trailingActivation: null,
      },
    ]),
  }),
).find((section) => section.title === "Long Exit Conditions");
assert.equal(actionCards?.groups.length, 0);
assert.equal(actionCards?.stacks?.length, 1);
assert.equal(actionCards?.stacks?.[0]?.title, "Close");
assert.equal(
  actionCards?.stacks?.[0]?.rows?.find((row) => row.label === "Scope")?.value,
  "Fills at least 20% in profit",
);
assert.equal(
  recipeParamRows(
    dcaWithExits({
      exitActions: JSON.stringify([
        {
          id: "harvest",
          kind: "close",
          scope: { kind: "fills", minProfitPct: 20 },
          groups: [],
          takeProfitPct: null,
          takeProfitPrice: null,
          stopLossPct: null,
          stopLossPrice: null,
          trailingDistance: null,
          trailingActivation: null,
        },
      ]),
    }),
  ).some((row) => row.label === "Take profit"),
  false,
);

console.log("backtest param section checks passed");
