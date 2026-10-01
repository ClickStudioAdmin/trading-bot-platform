import assert from "node:assert/strict";
import type { BacktestRecipe } from "./model";
import {
  indicatorConditionLabel,
  indicatorStyleTargets,
  replayChartSeries,
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
};

const rows = replayIndicatorLegend([layer], 1);
assert.equal(rows.length, 1);
assert.equal(rows[0]?.name, "BB 20 · 6h · Secondary entry");
assert.deepEqual(
  rows[0]?.values.map((value) => value.text),
  ["upper 110", "100", "lower 90"],
);
assert.deepEqual(replayIndicatorLegend([layer], 0)[0]?.values, []);

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

console.log("chart-series.check: ok");
