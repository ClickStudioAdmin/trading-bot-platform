import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { defaultPaperLayer } from "@/lib/engine/rules";
import {
  snapshotDcaRecipe,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
} from "@/lib/templates/recipe";
import type { StrategyLeaf } from "@/lib/strategy/expr";
import { adminConditionReview } from "./condition-list-samples";
import {
  backtestListedSections,
  filterParamSections,
  paramSectionsHaveBothSides,
  paramSideShows,
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
  labels.includes("Activation %"),
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
  ["Basis", "Stop loss %"],
);
assert.deepEqual(
  nestedStop?.groups
    .find((group) => group.title === "Breakeven Stop")
    ?.rows.map((row) => row.label),
  ["Activation %", "Buffer %", "Applies To"],
);
assert.equal(
  nestedStop?.groups.some((group) => group.title === "Move Breakeven"),
  false,
);
const breakevenOnly = recipeParamSections(
  dcaWithExits({ breakevenActivationPct: "1.5" }),
).find((section) => section.title === "Long Exit Conditions");
assert.equal(
  breakevenOnly?.groups.some(
    (group) =>
      group.rows.some((row) => row.label === "Stop loss" && row.value === "Off"),
  ),
  true,
);
assert.deepEqual(
  breakevenOnly?.groups
    .find((group) => group.title === "Breakeven Stop")
    ?.rows.map((row) => row.label),
  ["Activation %", "Buffer %", "Applies To"],
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
const sizedAddSections = recipeParamSections({
  ...perps,
  addStack: {
    leaves: [
      {
        kind: "retrace",
        source: "last",
        from: "high",
        pct: 2,
        lookback: 20,
        timeframe: "15",
      },
      {
        kind: "protection",
        is: "protected",
        amount: "entire",
        pct: null,
      },
    ],
    joins: ["and", "and"],
    orders: [
      { size: "500", sizeUnit: "usdt", orderType: "market", limitPrice: "" },
    ],
  },
});
const sizedAdd = sizedAddSections.find(
  (section) => section.title === "Long Additional Orders",
);
assert.equal(sizedAdd?.groups.length, 0);
assert.deepEqual(
  sizedAdd?.stack?.groups[0]?.flatMap((condition) =>
    condition.rows.map((row) => `${row.label}: ${row.value}`),
  ),
  [
    "Condition Type: Retrace",
    "Price source: Last",
    "From: High",
    "Retrace %: 2",
    "Lookback: 20",
    "Timeframe: 15m",
    "Condition Type: Position protection",
    "Is: Protected",
    "Amount: Entire position",
    "Size: 500 USDT",
    "Unit: USDT",
    "Order: Market",
  ],
);
assert.equal(sizedAdd?.stack?.groups[0]?.at(-1)?.join, "none");
assert.equal(sizedAdd?.stack?.groups[0]?.at(-1)?.title, "Position Sizing");
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
  paperRows.some((row) => row.label === "Take profit" || row.label === "Take profit %"),
  false,
);
assert.equal(
  paperRows.some((row) => row.label === "Stop loss" || row.label === "Stop loss %"),
  false,
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
  actionCards?.stacks?.[0]?.rows?.find((row) => row.label === "Applies To")?.value,
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
const pricedAction = recipeParamSections(
  dcaWithExits({
    exitActions: JSON.stringify([
      {
        id: "tp",
        kind: "take_profit",
        scope: { kind: "all" },
        groups: [{ anchor: { trigger: "target" }, rows: [] }],
        takeProfitPct: 2,
        takeProfitPrice: null,
        stopLossPct: null,
        stopLossPrice: null,
        trailingDistance: null,
        trailingActivation: null,
      },
    ]),
  }),
).find((section) => section.title === "Long Exit Conditions");
const pricedRows =
  pricedAction?.stacks?.[0]?.groups?.flat().flatMap((group) => group.rows) ?? [];
assert.equal(
  pricedRows.some((row) => row.label === "Condition Type"),
  false,
);
assert.equal(pricedRows.find((row) => row.label === "Target %")?.value, "2%");

assert.equal(paramSectionsHaveBothSides(sections), false);
assert.equal(paramSectionsHaveBothSides(bothSections), true);
assert.deepEqual(
  filterParamSections(bothSections, "long").map((section) => section.title),
  [
    "General",
    "Long Entry Conditions",
    "Position Sizing",
    "Long Additional Orders",
    "Long Exit Conditions",
  ],
);
assert.deepEqual(
  filterParamSections(bothSections, "short").map((section) => section.title),
  [
    "General",
    "Short Entry Conditions",
    "Position Sizing",
    "Short Additional Orders",
    "Short Exit Conditions",
  ],
);
assert.deepEqual(
  filterParamSections(bothSections, "all").map((section) => section.title),
  bothSections.map((section) => section.title),
);
assert.equal(paramSideShows("all", "long"), true);
assert.equal(paramSideShows("all", "short"), true);
assert.equal(paramSideShows("long", "long"), true);
assert.equal(paramSideShows("long", "short"), false);
assert.equal(paramSideShows("short", "long"), false);
assert.equal(paramSideShows("short", "short"), true);

const divergence = {
  when: "bullish" as const,
  style: "regular" as const,
  pivotBars: 5,
  span: 50,
  minPricePct: null,
  minRsi: null,
};
const divergenceExit = recipeParamSections({
  ...dca,
  exitActions: [
    {
      id: "close",
      kind: "close",
      scope: { kind: "all" },
      groups: [
        {
          anchor: {
            trigger: "indicator",
            spec: {
              kind: "rsi_divergence",
              timeframe: "240",
              compare: "lte",
              level: null,
              period: 14,
              multiplier: null,
              divergence,
            },
          },
          rows: [],
        },
      ],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
    },
  ],
});
const exitRows =
  divergenceExit
    .find((section) => section.title === "Long Exit Conditions")
    ?.stacks?.flatMap((stack) => stack.groups.flat().flatMap((condition) => condition.rows)) ??
  [];
assert.equal(exitRows.find((row) => row.label === "When")?.value, "Bullish");
assert.equal(exitRows.find((row) => row.label === "Style")?.value, "Regular");
assert.equal(exitRows.find((row) => row.label === "Pivot bars")?.value, "5");
assert.equal(exitRows.find((row) => row.label === "Span")?.value, "50");
assert.equal(
  exitRows.some((row) => row.value === "Price is below"),
  false,
);

const retraceEntry = recipeParamSections({
  ...perps,
  entrySource: "retrace",
  triggerPrice: "1",
  retrace: {
    source: "last",
    from: "high",
    pct: 5,
    lookback: 20,
    timeframe: "60",
  },
  exitActions: [
    {
      id: "trail",
      kind: "trailing_stop",
      scope: { kind: "all" },
      groups: [{ anchor: { trigger: "trail" }, rows: [] }],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
      trailingPct: 5,
      trailingTriggerPct: 8,
      breakevenActivationPct: null,
      breakevenOffsetPct: null,
    },
  ],
});
const retraceRows =
  retraceEntry
    .find((section) => section.title === "Long Entry Conditions")
    ?.groups.flatMap((group) => group.rows) ?? [];
assert.deepEqual(
  retraceRows.map((row) => `${row.label}: ${row.value}`),
  [
    "Condition Type: Retrace",
    "Price source: Last",
    "From: High",
    "Retrace %: 5",
    "Lookback: 20",
    "Timeframe: 1h",
    "Secondary Entry Condition: Off",
  ],
);
assert.equal(
  retraceRows.some((row) => row.label === "Price" || row.label === "Compare"),
  false,
);
const trailRows =
  retraceEntry
    .find((section) => section.title === "Long Exit Conditions")
    ?.stacks?.[0]?.groups.flat().flatMap((condition) => condition.rows) ?? [];
assert.equal(trailRows.find((row) => row.label === "Activation %")?.value, "8%");
assert.equal(trailRows.find((row) => row.label === "Trailing %")?.value, "5%");

const shortRetrace = recipeParamSections({
  ...perps,
  direction: "both",
  entrySource: "retrace",
  retrace: {
    source: "last",
    from: "high",
    pct: 5,
    lookback: 20,
    timeframe: "60",
  },
  shortEntry: {
    entrySource: "retrace",
    webhookId: null,
    triggerBy: "last",
    triggerCompare: "lte",
    triggerPrice: 1,
    skipIfOpen: true,
    indicator: null,
    retrace: {
      source: "mark",
      from: "low",
      pct: 3,
      lookback: 10,
      timeframe: "15",
    },
    confirm: null,
    entryStack: { leaves: [], joins: [] },
  },
});
const shortRows =
  shortRetrace
    .find((section) => section.title === "Short Entry Conditions")
    ?.groups.flatMap((group) => group.rows) ?? [];
assert.equal(shortRows.find((row) => row.label === "From")?.value, "Low");
assert.equal(shortRows.find((row) => row.label === "Price source")?.value, "Mark");
assert.equal(shortRows.find((row) => row.label === "Retrace %")?.value, "3");
assert.equal(shortRows.find((row) => row.label === "Timeframe")?.value, "15m");

const dcaRetrace = recipeParamSections({
  ...dca,
  startKind: "retrace",
  shortStartKind: "retrace",
  direction: "both",
  retrace: {
    source: "last",
    from: "high",
    pct: 4,
    lookback: 12,
    timeframe: "15",
  },
  shortRetrace: {
    source: "index",
    from: "low",
    pct: 6,
    lookback: 8,
    timeframe: "60",
  },
});
assert.equal(
  dcaRetrace
    .find((section) => section.title === "Long Entry Conditions")
    ?.groups.flatMap((group) => group.rows)
    .find((row) => row.label === "Retrace %")?.value,
  "4",
);
assert.equal(
  dcaRetrace
    .find((section) => section.title === "Short Entry Conditions")
    ?.groups.flatMap((group) => group.rows)
    .find((row) => row.label === "From")?.value,
  "Low",
);

function additionalRows(leaf: StrategyLeaf) {
  return (
    recipeParamSections({
      ...perps,
      addStack: { leaves: [leaf], joins: ["and"] },
    })
      .find((section) => section.title === "Long Additional Orders")
      ?.stack?.groups[0]?.[0]?.rows.map((row) => `${row.label}: ${row.value}`) ?? []
  );
}
assert.deepEqual(
  additionalRows({
    kind: "price",
    triggerBy: "mark",
    compare: "lte",
    price: 80,
  }).slice(0, 4),
  [
    "Condition Type: Price cross",
    "Price source: Mark is",
    "Compare: At or below",
    "Price: 80",
  ],
);
assert.equal(
  additionalRows({ kind: "webhook", webhookId: "hook" })[0],
  "Condition Type: Signal webhook",
);
assert.match(
  additionalRows({
    kind: "indicator",
    start: {
      kind: "rsi",
      timeframe: "240",
      compare: "cross_gte",
      level: 30,
      period: 14,
      multiplier: null,
      slowPeriod: null,
    },
  }).join(" "),
  /Condition Type: Indicator/,
);
assert.match(
  additionalRows({
    kind: "trend",
    start: {
      kind: "supertrend",
      timeframe: "240",
      compare: "cross_gte",
      level: null,
      period: 10,
      multiplier: 3,
      slowPeriod: null,
    },
  }).join(" "),
  /Condition Type: Trend/,
);
assert.deepEqual(
  additionalRows({
    kind: "protection",
    is: "unprotected",
    amount: "at_least",
    pct: 25,
  }),
  [
    "Condition Type: Position protection",
    "Is: Not protected",
    "Amount: At least 25%",
  ],
);

const closeRetrace = recipeParamSections({
  ...perps,
  exitActions: [
    {
      id: "close",
      kind: "close",
      scope: { kind: "all" },
      groups: [
        {
          anchor: {
            trigger: "retrace",
            source: "last",
            from: "high",
            pct: "3",
            lookback: "20",
            timeframe: "240",
          },
          rows: [],
        },
      ],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
      breakevenActivationPct: null,
      breakevenOffsetPct: null,
    },
  ],
});
const closeRows =
  closeRetrace
    .find((section) => section.title === "Long Exit Conditions")
    ?.stacks?.[0]?.groups.flat().flatMap((condition) => condition.rows) ?? [];
assert.equal(closeRows.find((row) => row.label === "Condition Type")?.value, "Retrace");
assert.equal(closeRows.find((row) => row.label === "Retrace %")?.value, "3");
assert.equal(closeRows.find((row) => row.label === "Timeframe")?.value, "4h");
const divergenceEntry = recipeParamSections({
  ...dca,
  startKind: "indicator",
  indicatorKind: "rsi_divergence",
  indicatorCompare: "cross_lte",
  indicatorTimeframe: "240",
  indicatorPeriod: 14,
  leadDivergence: { ...divergence, when: "bearish", style: "hidden" },
});
const entryRows =
  divergenceEntry
    .find((section) => section.title === "Long Entry Conditions")
    ?.groups.flatMap((group) => group.rows) ?? [];
assert.equal(entryRows.find((row) => row.label === "When")?.value, "Bearish");
assert.equal(entryRows.find((row) => row.label === "Style")?.value, "Hidden");
assert.equal(
  entryRows.some((row) => row.value === "cross_lte" || row.value === "Price is below"),
  false,
);

console.log("backtest param section checks passed");
