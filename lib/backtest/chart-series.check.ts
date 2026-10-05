import assert from "node:assert/strict";
import type { BacktestRecipe } from "./model";
import { macdSeries, rsiSeries } from "@/lib/dca/indicators";
import {
  indicatorConditionLabel,
  indicatorRolesForReason,
  indicatorStyleTargets,
  replayChartSeries,
  replayIndicatorCatalog,
  groupReplayIndicatorRows,
  oscillatorPaneStretch,
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

const screenshotRoles = ["Entry", "Short secondary entry", "Short entry", "Secondary entry"];
assert.deepEqual(indicatorRolesForReason("entry", "short", screenshotRoles), [
  "Short entry",
  "Short secondary entry",
]);
assert.deepEqual(indicatorRolesForReason("entry", "long", screenshotRoles), [
  "Entry",
  "Secondary entry",
]);
assert.equal(
  indicatorRolesForReason("entry", "short", screenshotRoles).includes("Secondary entry"),
  false,
);
assert.deepEqual(indicatorRolesForReason("entry", "short", ["Entry", "Secondary entry"]), [
  "Entry",
  "Secondary entry",
]);
assert.deepEqual(indicatorRolesForReason("exit_if", "short", ["Hard exit", "Short hard exit"]), [
  "Short hard exit",
]);
assert.deepEqual(indicatorRolesForReason("exit_if", "short", ["Hard exit"]), ["Hard exit"]);

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
assert.equal(split.length, 1);
assert.equal(split[0]?.title.includes("Long entry"), true);
assert.equal(split[0]?.title.includes("Short secondary entry"), true);
assert.equal(split[0]?.roles.includes("Entry"), true);
assert.equal(split[0]?.roles.includes("Short secondary entry"), true);
assert.equal(replayIndicatorLegend(split, 0).length, 1);
const mid = split[0]?.price.find((plot) => plot.id.endsWith("-mid"));
const upper = split[0]?.price.find((plot) => plot.id.endsWith("-upper"));
assert.equal(mid?.color, "#6B7382");
assert.equal(upper?.color, "#9AA3B2");
assert.equal(
  indicatorStyleTargets(split[0]!).some((target) => target.label === "Middle"),
  true,
);

const otherTimeframe = replayChartSeries(
  {
    kind: "dca",
    startKind: "indicator",
    indicatorKind: "sma",
    indicatorPeriod: 21,
    indicatorTimeframe: "360",
    shortIndicatorKind: "sma",
    shortIndicatorPeriod: 21,
    shortIndicatorTimeframe: "15",
  } as BacktestRecipe,
  [{ timeMs: 1_000, open: 10, high: 12, low: 9, close: 11 }],
).layers;
assert.equal(otherTimeframe.length, 2);
assert.equal(otherTimeframe[0]?.timeframe, "360");
assert.equal(otherTimeframe[1]?.timeframe, "15");
assert.equal(replayIndicatorLegend(otherTimeframe, 0).length, 2);

const separated = replayIndicatorLegend(
  replayChartSeries(
    {
      kind: "dca",
      startKind: "indicator",
      indicatorKind: "sma",
      indicatorPeriod: 21,
      indicatorTimeframe: "360",
      confirm: {
        kind: "ema",
        timeframe: "360",
        compare: "gte",
        level: null,
        period: 21,
        multiplier: null,
      },
      shortConfirm: {
        kind: "sma",
        timeframe: "15",
        compare: "lte",
        level: null,
        period: 21,
        multiplier: null,
      },
    } as BacktestRecipe,
    [{ timeMs: 1_000, open: 10, high: 12, low: 9, close: 11 }],
  ).layers,
  0,
);
assert.deepEqual(
  separated.map((row) => row.name.split(" · ").slice(0, 2).join(" · ")),
  ["SMA 21 · 6h", "SMA 21 · 15m", "EMA 21 · 6h"],
);

const paneLegend = replayIndicatorLegend(
  replayChartSeries(
    {
      kind: "dca",
      startKind: "indicator",
      indicatorKind: "sma",
      indicatorPeriod: 21,
      indicatorTimeframe: "60",
      shortIndicatorKind: "macd",
      shortIndicatorTimeframe: "60",
      confirm: {
        kind: "rsi",
        timeframe: "60",
        compare: "lte",
        level: 30,
        period: 14,
        multiplier: null,
      },
    } as BacktestRecipe,
    Array.from({ length: 40 }, (_, index) => ({
      timeMs: index * 60_000,
      open: 100 + index,
      high: 102 + index,
      low: 99 + index,
      close: 101 + index,
    })),
  ).layers,
  39,
);
assert.deepEqual(
  paneLegend.map((row) => row.pane),
  ["price", "oscillator", "oscillator"],
);
assert.equal(paneLegend.filter((row) => row.pane === "price").length, 1);
assert.equal(paneLegend[1]?.name.includes("MACD"), true);
assert.equal(paneLegend[2]?.name.includes("RSI"), true);
assert.equal(paneLegend[1]?.values.some((value) => value.text.startsWith("MACD")), true);
assert.equal(paneLegend[2]?.values.length > 0, true);

const paneOrder = groupReplayIndicatorRows([
  { id: "rsi-6h", name: "RSI 14 · 6h · Long entry", values: [], pane: "oscillator" },
  { id: "sma-6h", name: "SMA 21 · 6h · Long entry", values: [], pane: "price" },
  { id: "macd", name: "MACD · 6h · Long entry", values: [], pane: "oscillator" },
  { id: "sma-15", name: "SMA 21 · 15m · Short entry", values: [], pane: "price" },
  { id: "rsi-15", name: "RSI 14 · 15m · Short entry", values: [], pane: "oscillator" },
]);
assert.deepEqual(
  paneOrder.filter((row) => row.pane !== "oscillator").map((row) => row.id),
  ["sma-6h", "sma-15"],
);
assert.deepEqual(
  paneOrder.filter((row) => row.pane === "oscillator").map((row) => row.id),
  ["rsi-6h", "macd", "rsi-15"],
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
assert.equal(catalog.find((row) => row.id === "sma")?.label, "Simple Moving Average");
assert.equal(catalog.find((row) => row.id === "ema")?.label, "Exponential Moving Average");
assert.equal(catalog.find((row) => row.id === "bb")?.label, "Bollinger Bands");
assert.equal(catalog.some((row) => row.id === "ema_cross" || row.id === "sma_cross"), false);

const crossRecipe = {
  kind: "dca",
  startKind: "indicator",
  indicatorKind: "sma_cross",
  indicatorPeriod: 9,
  indicatorSlowPeriod: 21,
  indicatorTimeframe: "60",
  confirm: {
    kind: "ema",
    timeframe: "60",
    compare: "gte",
    level: null,
    period: 21,
    multiplier: null,
  },
} as BacktestRecipe;
const crossCatalog = replayIndicatorCatalog(crossRecipe);
assert.equal(crossCatalog.filter((row) => row.label.includes("Moving Average")).length, 2);
assert.equal(crossCatalog.find((row) => row.id === "sma")?.locked, true);
assert.equal(crossCatalog.find((row) => row.id === "ema")?.locked, true);
const crossLayers = replayChartSeries(
  crossRecipe,
  [{ timeMs: 60_000, open: 10, high: 12, low: 9, close: 11 }],
  ["sma", "ema"],
).layers;
assert.equal(crossLayers.some((row) => row.id === "ref:sma" || row.id === "ref:ema"), false);

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

const widePanes = oscillatorPaneStretch(600, 2);
assert.equal(widePanes?.oscillator, 120);
assert.equal(widePanes?.price, 360);
const tightPanes = oscillatorPaneStretch(280, 2);
assert.equal(tightPanes?.oscillator, 60);
assert.equal(tightPanes?.price, 160);
const onePane = oscillatorPaneStretch(600, 1);
assert.equal(onePane?.oscillator, 120);
assert.equal(onePane?.price, 480);
assert.equal(oscillatorPaneStretch(0, 2), null);
assert.equal(oscillatorPaneStretch(400, 0), null);

console.log("chart-series.check: ok");
