import assert from "node:assert/strict";
import {
  defaultIndicatorLineStyle,
  indicatorLineStyle,
  parseIndicatorStyles,
  resetIndicatorStyle,
  saveIndicatorStyleGlobal,
  serializeIndicatorStyles,
  writeIndicatorLineStyle,
} from "./indicator-style";

const fallback = defaultIndicatorLineStyle();
assert.deepEqual(fallback, { color: null, lineWidth: 2, visible: true });
assert.deepEqual(parseIndicatorStyles(null), {});
assert.deepEqual(parseIndicatorStyles("not json"), {});
assert.deepEqual(parseIndicatorStyles(JSON.stringify({ bad: { nope: 1 } })), {});

const saved = parseIndicatorStyles(
  JSON.stringify({
    layer: {
      lines: {
        mid: { color: "accent", lineWidth: 3, visible: false },
        upper: { color: "nope", lineWidth: 9, visible: true },
      },
    },
  }),
);
assert.deepEqual(saved.layer?.lines.mid, {
  color: "accent",
  lineWidth: 3,
  visible: false,
});
assert.deepEqual(saved.layer?.lines.upper, {
  color: null,
  lineWidth: 2,
  visible: true,
});

const session = writeIndicatorLineStyle({}, "layer", "mid", {
  color: "danger",
  lineWidth: 1,
  visible: true,
});
assert.deepEqual(indicatorLineStyle(session, saved, "layer", "mid").color, "danger");
assert.equal(indicatorLineStyle(session, saved, "layer", "upper").lineWidth, 2);
assert.deepEqual(indicatorLineStyle({}, saved, "missing", "mid"), fallback);

const global = saveIndicatorStyleGlobal(saved, session, "layer");
assert.equal(global.layer?.lines.mid?.color, "danger");
assert.equal(global.layer?.lines.upper?.visible, true);
assert.equal(serializeIndicatorStyles(global).includes("danger"), true);

const cleared = resetIndicatorStyle(global, "layer");
assert.equal(cleared.layer, undefined);
assert.equal(resetIndicatorStyle(cleared, "layer"), cleared);

console.log("indicator-style.check: ok");
