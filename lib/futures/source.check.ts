import assert from "node:assert/strict";
import { parseFuturesTradeSource } from "./model";
import {
  formatFuturesOrigin,
  formatFuturesSourceKind,
  futuresOriginLog,
  resolveOrderOrigin,
  withFuturesOrigin,
} from "./source";

assert.equal(formatFuturesSourceKind("engine"), "Auto");
assert.equal(formatFuturesSourceKind("manual"), "Manual");
assert.equal(formatFuturesSourceKind("webhook"), "Webhook");
assert.equal(formatFuturesOrigin({ source: "manual" }), "Manual");
assert.equal(formatFuturesOrigin({ source: "engine" }), "Auto");
assert.equal(formatFuturesOrigin({ source: "webhook" }), "Webhook");
assert.equal(
  formatFuturesOrigin({ source: "engine", ruleName: "DCA 1INCH" }),
  "Auto · DCA 1INCH",
);
assert.equal(
  formatFuturesOrigin({ source: "webhook", ruleName: "Custom TV Strategy" }),
  "Webhook · Custom TV Strategy",
);
assert.equal(
  formatFuturesOrigin({ source: "manual", ruleName: "ignored" }),
  "Manual",
);
assert.equal(
  formatFuturesSourceKind("engine", "Custom TV Strategy", [
    "Custom TV Strategy",
  ]),
  "Webhook",
);
assert.equal(
  formatFuturesOrigin({
    source: "engine",
    ruleName: "Custom TV Strategy",
    webhookNames: ["Custom TV Strategy"],
  }),
  "Webhook · Custom TV Strategy",
);
assert.equal(
  formatFuturesSourceKind("engine", "DCA 1INCH", ["Custom TV Strategy"]),
  "Auto",
);
assert.equal(
  formatFuturesSourceKind("engine", "Custom TV Strategy"),
  "Auto",
);
assert.equal(formatFuturesSourceKind("engine", "TradingView", []), "Webhook");
assert.equal(
  formatFuturesSourceKind("engine", "TV BTC", ["TV BTC"]),
  "Webhook",
);
assert.deepEqual(futuresOriginLog({ source: "manual" }), { source: "manual" });
assert.deepEqual(
  futuresOriginLog({ source: "engine", ruleName: "  TV BTC  " }),
  { source: "engine", ruleName: "TV BTC" },
);
assert.deepEqual(
  futuresOriginLog({ source: "webhook", ruleName: "Custom TV Strategy" }),
  { source: "webhook", ruleName: "Custom TV Strategy" },
);
assert.equal(
  withFuturesOrigin("Opened BTCUSDT long", {
    source: "engine",
    ruleName: "DCA 1INCH",
  }),
  "Opened BTCUSDT long · Auto · DCA 1INCH",
);
assert.equal(
  withFuturesOrigin("Opened BTCUSDT long", {
    source: "webhook",
    ruleName: "Custom TV Strategy",
  }),
  "Opened BTCUSDT long · Webhook · Custom TV Strategy",
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
assert.equal(parseFuturesTradeSource("webhook"), "webhook");
assert.equal(parseFuturesTradeSource("engine"), "engine");
assert.equal(parseFuturesTradeSource("manual"), "manual");
assert.equal(parseFuturesTradeSource("other"), "manual");

console.log("futures source checks passed");
