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
assert.equal(value(dca, "Long entry", "Start"), "Price");
assert.equal(value(dca, "Long entry", "Price"), "Last is at or below 100");
assert.equal(value(dca, "Short entry", "Price"), "Mark is at or above 120");
assert.match(value(dca, "Long entry", "Secondary entry"), /RSI 14/);
assert.equal(value(dca, "Short entry", "Secondary entry"), "Off");
assert.equal(value(dca, "Position Sizing", "Max orders"), "5");
assert.equal(value(dca, "Position Sizing", "Max value"), "No max value");
assert.equal(value(dca, "Position Sizing", "Order size"), "25 USDT");
assert.equal(value(dca, "Position Sizing", "Price deviation"), "2%");
assert.equal(value(dca, "Position Sizing", "Order"), "Market");
assert.equal(value(dca, "Position Sizing", "Order size multiplier"), "1.5");
assert.equal(
  value(dca, "Exit Conditions", "Take profit"),
  "1.2% · Average entry · Market",
);
assert.equal(
  value(dca, "Exit Conditions", "Stop loss"),
  "Move breakeven at 0.8% · offset 0.1%",
);
assert.equal(
  dca
    .find((row) => row.title === "Exit Conditions")
    ?.lines.some((line) => line.label === "Move breakeven"),
  false,
);
assert.equal(value(dca, "Exit Conditions", "Long Hard exit"), "Off");
assert.match(value(dca, "Exit Conditions", "Short Hard exit"), /RSI 14/);

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
assert.equal(value(perps, "Long entry", "Initial order trigger"), "Price cross");
assert.equal(value(perps, "Long entry", "Price"), "Last is at or above 2500");
assert.equal(value(perps, "Long entry", "Secondary entry"), "Off");

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
  value(stacked, "Long entry", "Entry conditions"),
  /^and RSI 14 at or below 30/,
);
assert.match(value(stacked, "Long entry", "Entry conditions"), /or Price is above EMA 21/);
assert.equal(value(perps, "Position Sizing", "Size"), "10 USDT");
assert.equal(value(perps, "Exit Conditions", "Take profit"), "3% · Last · Market");
assert.equal(value(perps, "Exit Conditions", "Stop loss"), "Off");
assert.equal(value(perps, "Exit Conditions", "Hard exit"), "Off");
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
  value(perpsStop, "Exit Conditions", "Stop loss"),
  "2% · Mark · Market · Move breakeven at 1.5% · offset 0.2%",
);

const closeRule = perpsBotConfig({
  ...defaultFuturesAutomationForm(0, "ETHUSDT"),
  formAction: "close_long",
  size: "",
});
assert.equal(value(closeRule, "Position Sizing", "Qty to close"), "All");
assert.equal(
  closeRule.find((row) => row.title === "Exit Conditions"),
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
assert.equal(value(carry, "Exit Conditions", "Take profit"), "Off");
assert.equal(
  value(carry, "Exit Conditions", "Exit order type"),
  "Fixed (entire position)",
);

console.log("bot-config checks passed");
