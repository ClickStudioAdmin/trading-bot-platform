import assert from "node:assert/strict";
import { defaultReplayChartAppearance } from "./chart-appearance";
import {
  defaultReplayViewPreferences,
  mergeReplayIndicatorStyles,
  parseReplayViewPreferences,
  replayViewFromLocal,
  serializeReplayViewPreferences,
} from "./replay-preferences";

const parsed = parseReplayViewPreferences({
  positionsRight: "yes",
  chartInterval: "weekly",
  referenceIndicators: ["nope", "ema", "rsi", "rsi", "atr_band"],
  referenceInputs: {
    nope: { length: 10 },
    rsi: { length: 900, slowLength: "fast", signal: 0 },
    bb: { stddev: 80.04, length: 1.2 },
    macd: { multiplier: "wide" },
  },
  chartAppearance: { series: "bars", gridOpacity: 240, up: "nope" },
  indicatorStyles: {
    "bad id": { lines: { mid: { color: "accent", lineWidth: 3 } } },
    "ref:bb": {
      lines: {
        "ref:bb-upper": { color: "accent", opacity: 40, lineWidth: 9, visible: false },
        "": { color: "success" },
      },
    },
  },
});

assert.equal(parsed.positionsRight, false);
assert.equal("chartInterval" in parsed, false);
assert.deepEqual(parsed.referenceIndicators, ["rsi", "ema", "atr_band"]);
assert.deepEqual(parsed.referenceInputs.rsi, { length: 400, signal: 2 });
assert.deepEqual(parsed.referenceInputs.bb, { length: 2, stddev: 50 });
assert.equal(parsed.referenceInputs.macd, undefined);
assert.equal("nope" in parsed.referenceInputs, false);
assert.equal(parsed.chartAppearance.series, "candles");
assert.equal(parsed.chartAppearance.gridOpacity, 100);
assert.equal(parsed.chartAppearance.up, null);
assert.equal(parsed.indicatorStyles["bad id"], undefined);
assert.deepEqual(parsed.indicatorStyles["ref:bb"]?.lines["ref:bb-upper"], {
  color: "accent",
  opacity: 40,
  lineWidth: 2,
  visible: false,
});
assert.equal(parsed.indicatorStyles["ref:bb"]?.lines[""], undefined);

const defaults = defaultReplayViewPreferences();
assert.deepEqual(defaults.chartAppearance, defaultReplayChartAppearance());
assert.equal(parseReplayViewPreferences(null).positionsRight, false);
assert.equal("chartInterval" in parseReplayViewPreferences({ chartInterval: "60" }), false);

const merged = mergeReplayIndicatorStyles(
  { "ref:rsi": { lines: { rsi: { color: "accent", opacity: 100, lineWidth: 2, visible: true } } } },
  { "ref:rsi": { lines: { rsi: { color: "danger", opacity: 80, lineWidth: 1, visible: true } } } },
);
assert.equal(merged["ref:rsi"]?.lines.rsi?.color, "danger");
assert.equal(merged["ref:rsi"]?.lines.rsi?.lineWidth, 1);

const local = replayViewFromLocal(
  null,
  JSON.stringify({ series: "line", grid: "accent" }),
  JSON.stringify({
    "ref:sma": { lines: { "ref:sma-mid": { color: "warning", lineWidth: 1 } } },
  }),
);
assert.equal(local.chartAppearance.series, "line");
assert.equal(local.chartAppearance.grid, "accent");
assert.equal(local.indicatorStyles["ref:sma"]?.lines["ref:sma-mid"]?.color, "warning");
assert.equal(local.positionsRight, false);

const fallback = replayViewFromLocal(
  JSON.stringify({
    positionsRight: true,
    chartInterval: "60",
    referenceIndicators: ["macd"],
    chartAppearance: { series: "line" },
    indicatorStyles: {},
    referenceInputs: {},
  }),
  JSON.stringify({ series: "candles" }),
  null,
);
assert.equal(fallback.positionsRight, true);
assert.equal("chartInterval" in fallback, false);
assert.equal(fallback.chartAppearance.series, "line");
assert.deepEqual(fallback.referenceIndicators, ["macd"]);

const again = parseReplayViewPreferences(JSON.parse(serializeReplayViewPreferences(parsed)));
assert.equal(serializeReplayViewPreferences(parsed), serializeReplayViewPreferences(again));

console.log("replay-preferences.check: ok");
