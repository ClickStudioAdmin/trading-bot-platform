import assert from "node:assert/strict";
import type { BacktestRecipe } from "./model";
import { macdSeries, rsiSeries } from "@/lib/dca/indicators";
import {
  indicatorConditionLabel,
  indicatorStyleTargets,
  replayChartSeries,
  replayIndicatorCatalog,
  replayIndicatorLegend,
  type IndicatorLayer,
} from "./chart-series";

const layer: IndicatorLayer = {
  id: "bb",
  title: "BB 20 · 6h · Secondary entry",
  roles: ["Secondary entry"],
  timeframe: "360",
  pane: "price",
  price: [
    {
      id: "upper",
      title: "BB 20 · 6h · Secondary entry upper",
      color: "#9AA3B2",
      values: [null, 110],
    },
    {
      id: "mid",
      title: "BB 20 · 6h · Secondary entry",
      color: "#6B7382",
      values: [null, 100],
    },
    {
      id: "lower",
      title: "BB 20 · 6h · Secondary entry lower",
      color: "#9AA3B2",
      values: [null, 90],
    },
  ],
  oscillator: null,
  dotValues: [null, 100],
  inputs: [
    { id: "length", label: "Length", value: 20, min: 2, max: 400, step: 1 },
    { id: "stddev", label: "StdDev", value: 2, min: 0.1, max: 50, step: 0.1 },
  ],
  inputsLocked: true,
  timeframeLabel: "6h",
};

const rows = replayIndicatorLegend([layer], 1);
assert.equal(rows.length, 1);
assert.equal(rows[0]?.name, "BB 20 · 6h · Secondary entry");
assert.deepEqual(
  rows[0]?.values.map((value) => value.text),
  ["Upper 110", "Middle 100", "Lower 90"],
);
assert.deepEqual(replayIndicatorLegend([layer], 0)[0]?.values, []);

const single = replayIndicatorLegend(
  [
    {
      ...layer,
      id: "sma",
      title: "SMA 21 · 6h · Long entry",
      price: [
        {
          id: "sma",
          title: "SMA 21 · 6h · Long entry",
          color: "#A78BFA",
          values: [1727.68],
        },
      ],
    },
  ],
  0,
);
assert.deepEqual(single[0]?.values.map((value) => value.text), ["1,727.68"]);

const trend = replayIndicatorLegend(
  [
    {
      ...layer,
      id: "st",
      title: "Supertrend 10 × 3 · 4h · Long entry",
      price: [
        { id: "st-up", title: "Supertrend 10 × 3 · 4h · Long entry", color: "#34D399", values: [12] },
        { id: "st-down", title: "Supertrend 10 × 3 · 4h · Long entry", color: "#F07167", values: [9] },
      ],
    },
  ],
  0,
);
assert.deepEqual(trend[0]?.values.map((value) => value.text), ["Up 12", "Down 9"]);

assert.equal(indicatorConditionLabel("Entry"), "Long entry");
assert.equal(indicatorConditionLabel("Secondary entry"), "Long secondary entry");
assert.equal(indicatorConditionLabel("Hard exit"), "Long hard exit");
assert.equal(indicatorConditionLabel("Short entry"), "Short entry");
assert.equal(indicatorConditionLabel("Short secondary entry"), "Short secondary entry");
assert.equal(indicatorConditionLabel("Short hard exit"), "Short hard exit");

const split = replayChartSeries(
  {
    kind: "dca",
    startKind: "indicator",
    indicatorKind: "bb",
    indicatorPeriod: 20,
    indicatorTimeframe: "360",
    shortConfirm: {
      kind: "bb",
      timeframe: "360",
      compare: "lte",
      level: null,
      period: 20,
      multiplier: null,
    },
  } as BacktestRecipe,
  [{ timeMs: 1_000, open: 10, high: 12, low: 9, close: 11 }],
).layers;
assert.equal(split.length, 2);
assert.equal(split[0]?.title.includes("Long entry"), true);
assert.equal(split[1]?.title.includes("Short secondary entry"), true);
assert.equal(split[0]?.roles.includes("Entry"), true);
assert.equal(split[1]?.roles.includes("Short secondary entry"), true);
const longMid = split[0]?.price.find((plot) => plot.id.endsWith("-mid"));
const shortMid = split[1]?.price.find((plot) => plot.id.endsWith("-mid"));
const longUpper = split[0]?.price.find((plot) => plot.id.endsWith("-upper"));
const shortUpper = split[1]?.price.find((plot) => plot.id.endsWith("-upper"));
assert.equal(longMid?.color, "#6B7382");
assert.equal(shortMid?.color, "#F5B942");
assert.equal(longUpper?.color, "#9AA3B2");
assert.equal(shortUpper?.color, "#9AA3B2");
assert.equal(
  indicatorStyleTargets(split[0]!).some((target) => target.label === "Middle"),
  true,
);

const catalogRecipe = {
  kind: "dca",
  startKind: "indicator",
  indicatorKind: "rsi",
  indicatorPeriod: 14,
  indicatorTimeframe: "15",
  confirm: {
    kind: "supertrend",
    timeframe: "240",
    compare: "gte",
    level: null,
    period: 10,
    multiplier: 3,
  },
} as BacktestRecipe;
const catalog = replayIndicatorCatalog(catalogRecipe);
assert.equal(catalog.find((row) => row.id === "rsi")?.locked, true);
assert.equal(catalog.find((row) => row.id === "rsi")?.label, "RSI");
assert.equal(catalog.find((row) => row.id === "rsi")?.label.includes("Long entry"), false);
assert.equal(new Set(catalog.map((row) => row.id)).size, catalog.length);
assert.equal(catalog.find((row) => row.id === "supertrend")?.locked, true);
assert.equal(catalog.find((row) => row.id === "macd")?.locked, false);
assert.equal(catalog.find((row) => row.id === "atr_band")?.locked, false);
assert.equal(catalog.some((row) => row.id === "ema_cross"), true);

const withReference = replayChartSeries(
  catalogRecipe,
  [{ timeMs: 60_000, open: 10, high: 12, low: 9, close: 11 }],
  ["macd", "rsi", "nope"],
).layers;
assert.equal(withReference.some((row) => row.roles.includes("Reference") && row.title.includes("MACD")), true);
assert.equal(withReference.filter((row) => row.title.includes("RSI")).length, 1);
assert.equal(withReference.some((row) => row.roles.includes("Reference") && row.title.includes("RSI")), false);

const strategyRsi = replayChartSeries(catalogRecipe, [
  { timeMs: 60_000, open: 10, high: 12, low: 9, close: 11 },
]).layers.find((row) => row.roles.includes("Entry"));
assert.equal(strategyRsi?.inputsLocked, true);
assert.equal(strategyRsi?.inputs.find((field) => field.id === "length")?.value, 14);
assert.equal(strategyRsi?.timeframeLabel, "15m");
assert.equal(split[0]?.inputsLocked, true);
assert.equal(split[0]?.inputs.find((field) => field.id === "length")?.value, 20);
assert.equal(split[0]?.inputs.find((field) => field.id === "stddev")?.value, 2);
assert.equal(split[0]?.timeframeLabel, "6h");

const closes = Array.from({ length: 40 }, (_, index) => 100 + index);
const bars = closes.map((close, index) => ({
  timeMs: index * 60_000,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
}));
const bare = { kind: "dca", startKind: "price" } as BacktestRecipe;
const referenceRsi = replayChartSeries(bare, bars, ["rsi"], {
  rsi: { length: 30 },
}).layers.find((row) => row.id === "ref:rsi");
assert.equal(referenceRsi?.inputsLocked, false);
assert.equal(referenceRsi?.inputs.find((field) => field.id === "length")?.value, 30);
assert.equal(referenceRsi?.timeframeLabel, "Chart");
assert.deepEqual(referenceRsi?.oscillator?.rsi, rsiSeries(closes, 30));
const stillOneRsi = replayChartSeries(catalogRecipe, bars, ["rsi"], {
  rsi: { length: 30 },
}).layers.filter((row) => row.title.includes("RSI"));
assert.equal(stillOneRsi.length, 1);
assert.equal(stillOneRsi[0]?.inputsLocked, true);
assert.equal(stillOneRsi[0]?.inputs.find((field) => field.id === "length")?.value, 14);

const referenceMacd = replayChartSeries(bare, bars, ["macd"], {
  macd: { length: 8, slowLength: 20, signal: 5 },
}).layers.find((row) => row.id === "ref:macd");
assert.equal(referenceMacd?.inputsLocked, false);
assert.equal(referenceMacd?.inputs.find((field) => field.id === "length")?.value, 8);
assert.equal(referenceMacd?.inputs.find((field) => field.id === "slowLength")?.value, 20);
assert.equal(referenceMacd?.inputs.find((field) => field.id === "signal")?.value, 5);
assert.deepEqual(referenceMacd?.oscillator?.macd, macdSeries(closes, 8, 20, 5).macd);
const sameMacd = replayChartSeries(bare, bars, ["macd"], {
  macd: { length: 10, slowLength: 21, signal: 7 },
}).layers.find((row) => row.id === "ref:macd");
assert.equal(sameMacd?.id, "ref:macd");

const clamped = replayChartSeries(bare, bars, ["rsi", "bb", "supertrend"], {
  rsi: { length: 1 },
  bb: { stddev: 99.96 },
  supertrend: { length: 900, multiplier: 1.26 },
}).layers;
assert.equal(clamped.find((row) => row.id === "ref:rsi")?.inputs[0]?.value, 2);
assert.equal(
  clamped.find((row) => row.id === "ref:bb")?.inputs.find((field) => field.id === "stddev")?.value,
  50,
);
assert.equal(
  clamped.find((row) => row.id === "ref:supertrend")?.inputs.find((field) => field.id === "length")
    ?.value,
  400,
);
assert.equal(
  clamped
    .find((row) => row.id === "ref:supertrend")
    ?.inputs.find((field) => field.id === "multiplier")?.value,
  1.3,
);

console.log("chart-series.check: ok");
