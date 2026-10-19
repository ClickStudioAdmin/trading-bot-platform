import assert from "node:assert/strict";
import { deskChartSeries, deskIndicatorCatalog } from "@/lib/backtest/chart-series";
import {
  defaultDeskChartView,
  parseDeskChartView,
  readDeskChartView,
  serializeDeskChartView,
} from "./desk-chart-view";

const defaults = defaultDeskChartView();
assert.equal(defaults.interval, "60");
assert.deepEqual(defaults.referenceIndicators, []);
assert.equal(defaults.chartAppearance.series, "candles");

const parsed = parseDeskChartView({
  interval: "15",
  favoriteIntervals: ["60", "nope", "60", "D"],
  referenceIndicators: ["rsi", "nope", "macd", "rsi"],
  referenceInputs: { rsi: { length: 21 }, nope: { length: 3 } },
  chartAppearance: { series: "line", upOpacity: 40 },
  indicatorStyles: {
    "ref:rsi": {
      lines: {
        rsi: { color: "#A78BFA", opacity: 80, lineWidth: 3, visible: true },
      },
    },
  },
});
assert.equal(parsed.interval, "15");
assert.deepEqual(parsed.favoriteIntervals, ["60", "D"]);
assert.deepEqual(parsed.referenceIndicators, ["rsi", "macd"]);
assert.equal(parsed.referenceInputs.rsi?.length, 21);
assert.equal(parsed.referenceInputs.macd, undefined);
assert.equal("nope" in parsed.referenceInputs, false);
assert.equal(parsed.chartAppearance.series, "line");
assert.equal(parsed.chartAppearance.upOpacity, 40);
assert.equal(parsed.indicatorStyles["ref:rsi"]?.lines.rsi?.lineWidth, 3);

const roundTrip = parseDeskChartView(JSON.parse(serializeDeskChartView(parsed)));
assert.deepEqual(roundTrip.referenceIndicators, parsed.referenceIndicators);
assert.equal(roundTrip.interval, "15");
assert.equal(readDeskChartView("not-json").interval, "60");
assert.equal(readDeskChartView(null).chartAppearance.gridOpacity, 30);

const catalog = deskIndicatorCatalog();
assert.equal(catalog.length, 8);
assert.equal(catalog.some((row) => row.id === "rsi_divergence"), true);
assert.equal(catalog.every((row) => row.locked === false), true);
const closes = Array.from({ length: 40 }, (_, index) => 100 + index);
const bars = closes.map((close, index) => ({
  timeMs: index * 60_000,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
}));
const rsi = deskChartSeries(bars, ["rsi"], { rsi: { length: 8 } }).layers.find(
  (row) => row.id === "ref:rsi",
);
assert.equal(rsi?.inputsLocked, false);
assert.equal(rsi?.pane, "oscillator");
assert.equal(rsi?.inputs.find((field) => field.id === "length")?.value, 8);
assert.equal(deskChartSeries(bars, []).layers.length, 0);

console.log("desk-chart-view.check: ok");
