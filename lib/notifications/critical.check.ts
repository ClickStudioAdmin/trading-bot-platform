import assert from "node:assert/strict";
import {
  CRITICAL_LOG_EVENTS,
  criticalDeskHref,
  criticalFamily,
  repeatingOrderShouldNotify,
  venueLabel,
} from "./critical-model";
import {
  deskOrderFailedKey,
  deskSyncFailedKey,
  exchangeVerifyFailedKey,
  operatorDeskCriticalKey,
  operatorGasLowKey,
  operatorSweepKey,
} from "./catalog";

assert.equal(criticalFamily("BTCUSDT"), "btcusdt");
assert.equal(criticalFamily("Limit Buy!!!"), "limit-buy");
assert.equal(criticalFamily(""), "desk");
assert.equal(repeatingOrderShouldNotify(1), false);
assert.equal(repeatingOrderShouldNotify(2), true);
assert.equal(repeatingOrderShouldNotify(5), true);
assert.equal(CRITICAL_LOG_EVENTS.includes("trade.order_failed"), true);
assert.equal(CRITICAL_LOG_EVENTS.includes("trade.open_failed"), true);
assert.equal(CRITICAL_LOG_EVENTS.includes("trade.futures_working_failed"), true);

assert.equal(
  criticalDeskHref({
    id: "11111111-1111-4111-8111-111111111111",
    userId: "u",
    name: "Live",
    mode: "live",
    deskType: "dca",
    venue: "bybit",
    venueEnvironment: "demo",
    copyOfAccountId: null,
    createdAtMs: 0,
  }).includes("/strategies/futures/activity"),
  true,
);
assert.equal(venueLabel("bybit"), "Bybit");

assert.equal(
  deskSyncFailedKey("desk-1", Date.parse("2026-09-16T00:00:00.000Z")),
  "desk-sync:desk-1:2026-09-16",
);
assert.equal(
  deskOrderFailedKey("desk-1", "btcusdt", Date.parse("2026-09-16T00:00:00.000Z")),
  "desk-order:desk-1:btcusdt:2026-09-16",
);
assert.equal(
  exchangeVerifyFailedKey("conn-1", Date.parse("2026-09-16T00:00:00.000Z")),
  "exchange-verify:conn-1:2026-09-16",
);
assert.equal(operatorSweepKey("tx-1"), "op-sweep:tx-1");
assert.equal(
  operatorGasLowKey("arbitrum-sepolia", Date.parse("2026-09-16T00:00:00.000Z")),
  "op-gas:arbitrum-sepolia:2026-09-16",
);
assert.equal(
  operatorDeskCriticalKey(
    "desk-1",
    "sync",
    Date.parse("2026-09-16T00:00:00.000Z"),
  ),
  "op-desk:desk-1:sync:2026-09-16",
);

console.log("notification critical checks passed");
