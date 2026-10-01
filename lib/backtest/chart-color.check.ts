import assert from "node:assert/strict";
import {
  CHART_COLOR_PALETTE,
  chartColorInputHex,
  clampChartOpacity,
  normalizeChartColor,
} from "./chart-color";

assert.equal(CHART_COLOR_PALETTE.length, 60);
assert.equal(CHART_COLOR_PALETTE[0], "#ffffff");
assert.equal(CHART_COLOR_PALETTE[9], "#000000");
assert.ok(CHART_COLOR_PALETTE.every((color) => /^#[0-9a-f]{6}$/.test(color)));

assert.equal(normalizeChartColor("accent"), "accent");
assert.equal(normalizeChartColor("#A1B"), "#aa11bb");
assert.equal(normalizeChartColor("#34D399"), "#34d399");
assert.equal(normalizeChartColor("nope"), null);
assert.equal(normalizeChartColor(null), null);

assert.equal(clampChartOpacity(65.4), 65);
assert.equal(clampChartOpacity(240), 100);
assert.equal(clampChartOpacity(-4), 0);
assert.equal(clampChartOpacity("nope"), 100);

assert.equal(chartColorInputHex("#abc", "#000000"), "#aabbcc");
assert.equal(chartColorInputHex("accent", "#34D399"), "#34d399");
assert.equal(chartColorInputHex(null, "nope"), "#000000");

console.log("chart-color.check: ok");
