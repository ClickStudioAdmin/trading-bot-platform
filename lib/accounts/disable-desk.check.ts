import assert from "node:assert/strict";
import {
  closePositionsDetail,
  deskDisableBotKind,
  disableBotsDetail,
  disableDeskConfirmBody,
  disableDeskSuccessBody,
  DISABLE_DESK_SUCCESS,
} from "./disable-desk";

assert.equal(
  deskDisableBotKind({ deskType: "cash_and_carry" }),
  "cnc",
);
assert.equal(deskDisableBotKind({ deskType: "flex" }), "flex");
assert.equal(deskDisableBotKind({ deskType: "dca" }), "dca");
assert.equal(deskDisableBotKind({ deskType: "manual" }), "none");
assert.equal(deskDisableBotKind({ deskType: "signal_follower" }), "none");
assert.equal(
  deskDisableBotKind({ deskType: "dca", copyOfAccountId: "parent" }),
  "copy",
);

assert.match(
  disableDeskConfirmBody("Alpha", "flex"),
  /Turn every bot off on Alpha/,
);
assert.match(disableDeskConfirmBody("Alpha", "flex"), /then close/);
assert.match(disableDeskConfirmBody("Beta", "copy"), /Pause copying on Beta/);
assert.match(disableDeskConfirmBody("Gamma", "none"), /Gamma has no bots/);

assert.equal(
  disableBotsDetail({ kind: "none", turnedOff: 0 }),
  "No bots on this desk.",
);
assert.equal(
  disableBotsDetail({ kind: "flex", turnedOff: 0 }),
  "Bots are already off.",
);
assert.equal(
  disableBotsDetail({ kind: "dca", turnedOff: 1 }),
  "Turned 1 bot off.",
);
assert.equal(
  disableBotsDetail({ kind: "cnc", turnedOff: 3 }),
  "Turned 3 bots off.",
);
assert.equal(
  disableBotsDetail({ kind: "copy", turnedOff: 1 }),
  "Copying paused.",
);
assert.equal(
  disableBotsDetail({ kind: "copy", turnedOff: 0 }),
  "Copying is already paused.",
);

assert.equal(
  closePositionsDetail({ closed: 0, cancelled: 0, pendingOnly: false }),
  "No open positions.",
);
assert.equal(
  closePositionsDetail({ closed: 0, cancelled: 0, pendingOnly: true }),
  "Positions are already closing.",
);
assert.equal(
  closePositionsDetail({ closed: 1, cancelled: 0, pendingOnly: false }),
  "Closed 1 position.",
);
assert.equal(
  closePositionsDetail({ closed: 2, cancelled: 1, pendingOnly: false }),
  "Closed 2 positions. Cancelled 1 order.",
);
assert.equal(
  closePositionsDetail({ closed: 0, cancelled: 4, pendingOnly: false }),
  "Cancelled 4 orders.",
);

assert.equal(DISABLE_DESK_SUCCESS, "Desk disabled.");
assert.equal(
  disableDeskSuccessBody({ closed: 0, cancelled: 0 }),
  "Bots are off. There were no open positions.",
);
assert.equal(
  disableDeskSuccessBody({ closed: 2, cancelled: 0 }),
  "Bots are off and positions are closed.",
);
assert.equal(
  disableDeskSuccessBody({ closed: 0, cancelled: 1 }),
  "Bots are off. Working orders are cancelled.",
);
assert.match(
  disableDeskSuccessBody({ closed: 1, cancelled: 1 }),
  /Positions are closed and working orders are cancelled/,
);

console.log("disable-desk.check: ok");
