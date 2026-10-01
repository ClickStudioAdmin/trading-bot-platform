import assert from "node:assert/strict";
import {
  clearReplayChartFields,
  pickReplayChartFields,
  colorWithOpacity,
  defaultReplayChartAppearance,
  mergeReplayChartAppearance,
  parseReplayChartAppearance,
  replayGridPaint,
  resetReplayChartFields,
  saveReplayChartAppearance,
  REPLAY_BAR_FIELDS,
  REPLAY_CANVAS_FIELDS,
} from "./chart-appearance";

assert.equal(defaultReplayChartAppearance().gridOpacity, 100);
assert.equal(parseReplayChartAppearance(null), null);
assert.equal(parseReplayChartAppearance("{"), null);
assert.equal(
  parseReplayChartAppearance(JSON.stringify({ up: "nope", gridOpacity: 240 }))?.gridOpacity,
  100,
);
assert.equal(
  parseReplayChartAppearance(JSON.stringify({ grid: "accent", gridOpacity: 40 }))?.grid,
  "accent",
);
assert.equal(
  parseReplayChartAppearance(JSON.stringify({ up: "#A1B", upOpacity: 40 }))?.up,
  "#aa11bb",
);
assert.equal(
  parseReplayChartAppearance(JSON.stringify({ up: "#A1B", upOpacity: 40 }))?.upOpacity,
  40,
);
assert.equal(parseReplayChartAppearance(JSON.stringify({}))?.backgroundOpacity, 100);

const saved = parseReplayChartAppearance(
  JSON.stringify({ up: "success", grid: "ink-muted", gridOpacity: 40 }),
);
const session = mergeReplayChartAppearance(saved, { up: null, gridOpacity: 10 });
assert.equal(session.up, null);
assert.equal(session.grid, "ink-muted");
assert.equal(session.gridOpacity, 10);

const global = saveReplayChartAppearance(saved, { background: "accent", gridOpacity: 25 });
assert.equal(global.background, "accent");
assert.equal(global.gridOpacity, 25);
assert.equal(global.up, "success");

assert.equal(resetReplayChartFields(global, REPLAY_CANVAS_FIELDS)?.up, "success");
assert.equal(resetReplayChartFields(global, REPLAY_CANVAS_FIELDS)?.gridOpacity, 100);
assert.equal(
  resetReplayChartFields({ ...defaultReplayChartAppearance(), up: "danger" }, REPLAY_BAR_FIELDS),
  null,
);
assert.deepEqual(clearReplayChartFields({ up: "danger", gridOpacity: 20 }, REPLAY_BAR_FIELDS), {
  gridOpacity: 20,
});
assert.deepEqual(
  pickReplayChartFields({ up: "danger", gridOpacity: 20 }, REPLAY_BAR_FIELDS),
  { up: "danger" },
);

assert.equal(colorWithOpacity("#34D399", 100), "rgba(52, 211, 153, 1)");
assert.equal(colorWithOpacity("#abc", 50), "rgba(170, 187, 204, 0.5)");
assert.equal(colorWithOpacity("rgb(10, 20, 30)", 25), "rgba(10, 20, 30, 0.25)");
assert.deepEqual(replayGridPaint("#2A313C", 100), { color: "#2A313C", visible: true });
assert.deepEqual(replayGridPaint("#2A313C", 0), { color: "#2A313C", visible: false });
assert.equal(replayGridPaint("#2A313C", 50).visible, true);
assert.equal(replayGridPaint("#2A313C", 50).color, "rgba(42, 49, 60, 0.5)");

console.log("chart-appearance.check: ok");
