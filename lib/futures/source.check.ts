import assert from "node:assert/strict";
import {
  formatFuturesOrigin,
  formatFuturesSourceKind,
  futuresOriginLog,
  resolveOrderOrigin,
  withFuturesOrigin,
} from "./source";

assert.equal(formatFuturesSourceKind("engine"), "Auto");
assert.equal(formatFuturesSourceKind("manual"), "Manual");
assert.equal(formatFuturesOrigin({ source: "manual" }), "Manual");
assert.equal(formatFuturesOrigin({ source: "engine" }), "Auto");
assert.equal(
  formatFuturesOrigin({ source: "engine", ruleName: "DCA 1INCH" }),
  "Auto · DCA 1INCH",
);
assert.equal(
  formatFuturesOrigin({ source: "manual", ruleName: "ignored" }),
  "Manual",
);
assert.deepEqual(futuresOriginLog({ source: "manual" }), { source: "manual" });
assert.deepEqual(
  futuresOriginLog({ source: "engine", ruleName: "  TV BTC  " }),
  { source: "engine", ruleName: "TV BTC" },
);
assert.equal(
  withFuturesOrigin("Opened BTCUSDT long", {
    source: "engine",
    ruleName: "DCA 1INCH",
  }),
  "Opened BTCUSDT long · Auto · DCA 1INCH",
);
assert.deepEqual(
  resolveOrderOrigin(
    { source: "engine", ruleName: null },
    { source: "engine", ruleName: "DCA 1INCH" },
  ),
  { source: "engine", ruleName: "DCA 1INCH" },
);
assert.deepEqual(
  resolveOrderOrigin(
    { source: "manual", ruleName: null },
    { source: "engine", ruleName: "DCA 1INCH" },
  ),
  { source: "manual", ruleName: null },
);

console.log("futures source checks passed");
