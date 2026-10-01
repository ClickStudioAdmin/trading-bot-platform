import assert from "node:assert/strict";
import { replayIndicatorLegend, type IndicatorLayer } from "./chart-series";

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

console.log("chart-series.check: ok");
