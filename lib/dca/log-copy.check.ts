import assert from "node:assert/strict";
import {
  dcaDecisionMessage,
  dcaDisarmedMessage,
  dcaEntryLabel,
  dcaExitClosedMessage,
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

assert.equal(
  dcaExitClosedMessage({
    name: "KMNO",
    reason: "take_profit",
    listens: true,
  }),
  "KMNO hit take profit. Waiting for the next start.",
);
assert.equal(
  dcaExitClosedMessage({
    name: "MYX",
    reason: "end_cycle",
    listens: false,
  }),
  "MYX position closed. Bot is idle.",
);
assert.equal(
  dcaExitClosedMessage({
    name: "NEAR",
    reason: "exit_if",
    listens: false,
    why: "Price is above SMA 21 · 15m.",
  }),
  "NEAR Hard Exit hit. Price is above SMA 21 · 15m. Bot is idle.",
);
assert.equal(
  dcaDisarmedMessage({
    name: "IBM",
    leftOpen: false,
    reason: "Minimum order value is $5.",
  }),
  "Disabled IBM. Minimum order value is $5.",
);
assert.equal(
  dcaDisarmedMessage({ name: "IBM", leftOpen: false }),
  "Disarmed IBM.",
);

console.log("dca log-copy checks passed");
