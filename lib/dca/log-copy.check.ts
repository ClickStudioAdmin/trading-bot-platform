import assert from "node:assert/strict";
import {
  dcaDecisionMessage,
  dcaEntryLabel,
  dcaSyncFailedHeadline,
  dcaSyncFailedMessage,
  dcaSyncReasonLabel,
} from "./log-copy";

assert.equal(dcaEntryLabel(0), "Entry # 1");
assert.equal(dcaEntryLabel(1), "Entry # 2");
assert.equal(dcaEntryLabel(14), "Entry # 15");

assert.equal(dcaSyncReasonLabel("rest_grid"), "Rest grid order");
assert.equal(dcaSyncReasonLabel("set_tpsl"), "Set take profit / stop");

assert.equal(
  dcaSyncFailedHeadline({ reason: "rest_grid", clipIndex: 7 }),
  "Could not rest Entry # 8",
);
assert.equal(
  dcaSyncFailedHeadline({ reason: "rest_grid" }),
  "Could not rest grid order",
);

assert.equal(
  dcaSyncFailedMessage({
    error: "Bind an exchange in Desk Settings before trading.",
    reason: "rest_grid",
    clipIndex: 7,
    maxClips: 15,
    limitPrice: 142.5,
  }),
  "Could not rest Entry # 8 of 15 at 142.5. Bind an exchange in Desk Settings before trading.",
);

assert.equal(
  dcaDecisionMessage({
    name: "DCA Test - SOL",
    kind: "clip",
    clipsFilled: 7,
    maxClips: 15,
  }),
  "DCA Test - SOL adding Entry # 8 of 15.",
);

assert.equal(
  dcaDecisionMessage({
    name: "DCA Test - ETH",
    kind: "stop_adding",
    maxClips: 15,
  }),
  "DCA Test - ETH hit the order cap (15 orders).",
);

assert.equal(
  dcaDecisionMessage({
    name: "DCA Test - SOL",
    kind: "close",
    reason: "exit_if",
  }),
  "DCA Test - SOL Hard Exit hit. Flattening.",
);

assert.equal(
  dcaDecisionMessage({
    name: "DCA Test - SOL",
    kind: "arm",
    why: "RSI 14 crosses below 30 · 15m, and Secondary Entry RSI 14 at or below 50 · 1h",
  }),
  "DCA Test - SOL start met. Placing the first order. RSI 14 crosses below 30 · 15m, and Secondary Entry RSI 14 at or below 50 · 1h.",
);

assert.equal(
  dcaDecisionMessage({
    name: "DCA Test - SOL",
    kind: "close",
    reason: "exit_if",
    why: "Supertrend 10 × 3 turns bearish · 15m",
  }),
  "DCA Test - SOL Hard Exit hit. Flattening. Supertrend 10 × 3 turns bearish · 15m.",
);

console.log("dca log-copy checks passed");
