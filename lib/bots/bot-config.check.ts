import assert from "node:assert/strict";
import { dcaBotConfig, paperBotConfig, perpsBotConfig } from "./bot-config";
import type { DcaPlaybook } from "@/lib/dca/playbook";
import { defaultFuturesAutomationForm } from "@/lib/futures/automation";
import { defaultPaperLayer, paperConfigToFormValues } from "@/lib/engine/rules";

function value(
  sections: { title: string; lines: { label: string; value: string }[] }[],
  title: string,
  label: string,
): string {
  const section = sections.find((row) => row.title === title);
  const line = section?.lines.find((row) => row.label === label);
  assert.ok(line, `${title} / ${label}`);
  return line.value;
}

const playbook = {
  symbol: "BTCUSDT",
  direction: "both",
  startKind: "price",
  armTrigger: { triggerBy: "last", compare: "lte", price: 100 },
  shortArmTrigger: { triggerBy: "mark", compare: "gte", price: 120 },
  confirm: {
    kind: "rsi",
    timeframe: "1h",
    compare: "lte",
    level: 30,
    period: 14,
  },
  shortConfirm: null,
  exitIf: null,
  shortExitIf: {
    kind: "rsi",
    timeframe: "15m",
    compare: "gte",
    level: 70,
    period: 14,
  },
  clipSize: 25,
  sizeUnit: "usdt",
  maxClips: 5,
  maxValue: null,
  maxValueKind: "usdt",
  dipPct: 2,
  intervalMinutes: null,
  sizeMultiplier: 1.5,
  deviationMultiplier: 1,
  spacingKind: "percent",
  dcaMode: "position",
  takeProfitPct: 1.2,
  takeProfitKind: "percent",
  takeProfitBasis: "average",
  takeProfitOrderType: "market",
  stopLossPct: null,
  trailingTriggerPct: null,
  trailingPct: null,
  breakevenActivationPct: 0.8,
  breakevenOffsetPct: 0.1,
} as unknown as DcaPlaybook;

const dca = dcaBotConfig(playbook);
assert.equal(value(dca, "General", "Contract"), "BTCUSDT");
assert.equal(value(dca, "General", "Direction"), "Both");
assert.equal(value(dca, "Long Entry Conditions", "Start"), "Price");
const splitDca = dcaBotConfig({
  ...playbook,
  shortStartKind: "indicator",
  shortIndicatorKind: "rsi",
  shortIndicatorTimeframe: "15",
  shortIndicatorCompare: "gte",
  shortIndicatorLevel: 70,
  shortIndicatorPeriod: 14,
});
assert.equal(value(splitDca, "Long Entry Conditions", "Start"), "Price");
assert.equal(value(splitDca, "Short Entry Conditions", "Start"), "Indicator");
assert.equal(value(dca, "Long Entry Conditions", "Price"), "Last is at or below 100");
assert.equal(value(dca, "Short Entry Conditions", "Price"), "Mark is at or above 120");
assert.match(value(dca, "Long Entry Conditions", "Secondary entry"), /RSI 14/);
assert.equal(value(dca, "Short Entry Conditions", "Secondary entry"), "Off");
assert.equal(value(dca, "General", "Max orders"), "5");
assert.equal(value(dca, "General", "Max value"), "No max value");
assert.equal(value(dca, "Position Sizing", "Order size"), "25 USDT");
assert.equal(value(dca, "Position Sizing", "Price deviation"), "2%");
assert.equal(value(dca, "Position Sizing", "Order"), "Market");
assert.equal(value(dca, "Position Sizing", "Order size multiplier"), "1.5");
assert.equal(
  value(dca, "Long Exit Conditions", "Take profit"),
  "1.2% · Average entry · Market",
);
assert.equal(
  value(dca, "Short Exit Conditions", "Take profit"),
  "1.2% · Average entry · Market",
);
assert.equal(value(dca, "Long Exit Conditions", "Stop loss"), "Off");
assert.equal(
  value(dca, "Long Exit Conditions", "Breakeven Stop"),
  "Activation % 0.8% · Buffer 0.1%",
);
assert.equal(value(dca, "Long Exit Conditions", "Custom conditions"), "Off");
assert.match(value(dca, "Short Exit Conditions", "Custom conditions"), /RSI 14/);
const splitExits = dcaBotConfig({
  ...playbook,
  stopLossPct: 9,
  shortClassic: {
    takeProfitKind: "percent",
    takeProfitAtrMult: null,
    takeProfitPct: 4,
    takeProfitBasis: "first_entry",
    takeProfitOrderType: "limit",
    stopLossPct: 3,
    stopLossBasis: "first_entry",
    breakevenActivationPct: 6,
    breakevenOffsetPct: 0.4,
    trailingTriggerPct: 8,
    trailingPct: 1,
    atrPeriod: null,
  },
});
assert.equal(
  value(splitExits, "Long Exit Conditions", "Take profit"),
  "1.2% · Average entry · Market",
);
assert.equal(
  value(splitExits, "Short Exit Conditions", "Take profit"),
  "4% · First fill · Limit",
);
assert.match(value(splitExits, "Long Exit Conditions", "Stop loss"), /9%/);
assert.equal(
  value(splitExits, "Short Exit Conditions", "Stop loss"),
  "3% · First fill",
);
assert.match(value(splitExits, "Short Exit Conditions", "Breakeven Stop"), /6%/);

const perps = perpsBotConfig({
  ...defaultFuturesAutomationForm(0, "ETHUSDT"),
  formAction: "buy",
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: "2500",
  skipIfOpen: true,
  size: "10",
  sizeUnit: "usdt",
  orderType: "market",
  tpsl: {
    takeProfit: 3,
    stopLoss: null,
    tpKind: "percent",
    slKind: "percent",
    tpTrigger: "last",
    slTrigger: "mark",
    mode: "full",
    tpQty: null,
    slQty: null,
    tpOrderType: "market",
    slOrderType: "market",
    tpLimitPrice: null,
    slLimitPrice: null,
  },
});
assert.equal(value(perps, "General", "Direction"), "Long");
assert.equal(value(perps, "Long Entry Conditions", "Initial order trigger"), "Price cross");
assert.equal(value(perps, "Long Entry Conditions", "Price"), "Last is at or above 2500");
assert.equal(value(perps, "Long Entry Conditions", "Secondary entry"), "Off");

const stacked = perpsBotConfig({
  ...defaultFuturesAutomationForm(0, "ETHUSDT"),
  formAction: "buy",
  entrySource: "price",
  triggerPrice: "2500",
  confirm: null,
  entryStack: {
    leaves: [
      {
        kind: "filter",
        spec: {
          kind: "rsi",
          timeframe: "15",
          compare: "lte",
          level: 30,
          period: 14,
          multiplier: null,
        },
      },
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
    joins: ["and", "or"],
  },
});
assert.match(
  value(stacked, "Long Entry Conditions", "Entry conditions"),
  /^and RSI 14 at or below 30/,
);
assert.match(value(stacked, "Long Entry Conditions", "Entry conditions"), /or Price is above EMA 21/);
assert.equal(value(perps, "Position Sizing", "Size"), "10 USDT");
assert.equal(value(perps, "Long Additional Orders", "Condition Type"), "Off");
assert.equal(value(perps, "Long Additional Orders", "Size"), "Off");
assert.equal(value(perps, "Long Additional Orders", "Unit"), "Off");
assert.equal(value(perps, "Long Additional Orders", "Order"), "Off");
assert.equal(value(perps, "Long Exit Conditions", "Take profit"), "3% · Last · Market");
assert.equal(value(perps, "Long Exit Conditions", "Stop loss"), "Off");
assert.equal(value(perps, "Long Exit Conditions", "Custom conditions"), "Off");
const perpsStop = perpsBotConfig({
  ...defaultFuturesAutomationForm(0, "ETHUSDT"),
  formAction: "buy",
  tpsl: {
    takeProfit: null,
    stopLoss: 2,
    tpKind: "percent",
    slKind: "percent",
    tpTrigger: "last",
    slTrigger: "mark",
    mode: "full",
    tpQty: null,
    slQty: null,
    tpOrderType: "market",
    slOrderType: "market",
    tpLimitPrice: null,
    slLimitPrice: null,
  },
  breakevenActivationPct: "1.5",
  breakevenOffsetPct: "0.2",
});
assert.equal(
  value(perpsStop, "Long Exit Conditions", "Stop loss"),
  "2% · Mark · Market",
);
assert.equal(
  value(perpsStop, "Long Exit Conditions", "Breakeven Stop"),
  "Activation % 1.5% · Buffer 0.2%",
);
const perpsBoth = perpsBotConfig({
  ...defaultFuturesAutomationForm(0, "ETHUSDT"),
  formAction: "buy",
  direction: "both",
  tpsl: {
    takeProfit: 3,
    stopLoss: 9,
    tpKind: "percent",
    slKind: "percent",
    tpTrigger: "last",
    slTrigger: "mark",
    mode: "full",
    tpQty: null,
    slQty: null,
    tpOrderType: "market",
    slOrderType: "market",
    tpLimitPrice: null,
    slLimitPrice: null,
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
    entryStack: { leaves: [], joins: [] },
    classic: {
      tpsl: {
        takeProfit: 7,
        stopLoss: 4,
        tpKind: "percent",
        slKind: "percent",
        tpTrigger: "index",
        slTrigger: "last",
        mode: "full",
        tpQty: null,
        slQty: null,
        tpOrderType: "market",
        slOrderType: "market",
        tpLimitPrice: null,
        slLimitPrice: null,
      },
      trailing: { distance: 1.5, activePrice: null, peak: null },
      breakevenActivationPct: 6,
      breakevenOffsetPct: 0.2,
    },
  },
});
assert.equal(value(perpsBoth, "Long Exit Conditions", "Take profit"), "3% · Last · Market");
assert.equal(value(perpsBoth, "Short Exit Conditions", "Take profit"), "7% · Index · Market");
assert.match(value(perpsBoth, "Long Exit Conditions", "Stop loss"), /9%/);
assert.equal(value(perpsBoth, "Short Exit Conditions", "Stop loss"), "4% · Last · Market");
assert.match(value(perpsBoth, "Short Exit Conditions", "Breakeven Stop"), /6%/);
assert.match(value(perpsBoth, "Short Exit Conditions", "Trailing stop"), /1.5/);
assert.equal(value(perpsBoth, "Long Additional Orders", "Condition Type"), "Off");
assert.equal(value(perpsBoth, "Short Additional Orders", "Size"), "Off");

const closeRule = perpsBotConfig({
  ...defaultFuturesAutomationForm(0, "ETHUSDT"),
  formAction: "close_long",
  size: "",
});
assert.equal(value(closeRule, "Position Sizing", "Qty to close"), "All");
assert.equal(
  closeRule.find((row) => row.title.endsWith("Additional Orders")),
  undefined,
);
assert.equal(
  closeRule.find(
    (row) =>
      row.title === "Exit Conditions" ||
      row.title.endsWith("Exit Conditions"),
  ),
  undefined,
);

const paper = paperConfigToFormValues({
  enabled: false,
  reduceOnly: false,
  layers: [
    {
      ...defaultPaperLayer(0),
      id: 4,
      name: "Carry A",
      minNetApr: 0.12,
      minDte: 10,
      maxDte: 40,
      sizeType: "fixed",
      notionalUsdt: 2500,
      maxOpenCount: 3,
      exitSizeType: "fixed",
    },
  ],
}).layers[0]!;
const carry = paperBotConfig(paper);
assert.equal(value(carry, "Entry Conditions", "Min APR %"), "12%");
assert.equal(value(carry, "Entry Conditions", "Min DTE"), "10");
assert.equal(value(carry, "Position Sizing", "Order type"), "Fixed");
assert.equal(value(carry, "Position Sizing", "Order size"), "2500 USDT");
assert.equal(value(carry, "Position Sizing", "Max pairs"), "3");
const carryExit = carry.find((row) => row.title === "Exit Conditions");
assert.equal(
  carryExit?.lines.some(
    (line) => line.label === "Take profit" || line.label === "Stop loss",
  ),
  false,
);
assert.equal(
  value(carry, "Exit Conditions", "Exit order type"),
  "Fixed (entire position)",
);

console.log("bot-config checks passed");
