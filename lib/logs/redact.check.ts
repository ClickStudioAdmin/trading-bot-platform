import assert from "node:assert/strict";
import { isSafeEventName, redactLogData } from "./redact";

const redacted = redactLogData({
  pair: "BTCUSDT-25JUN27",
  password: "hunter2",
  nested: { serviceRoleKey: "sb_secret", ok: true },
});
assert.equal(redacted.pair, "BTCUSDT-25JUN27");
assert.equal(redacted.password, "[redacted]");
assert.deepEqual(redacted.nested, { serviceRoleKey: "[redacted]", ok: true });

assert.equal(isSafeEventName("trade.opened"), true);
assert.equal(isSafeEventName("Trade.Opened"), false);
assert.equal(isSafeEventName(""), false);

console.log("event log redact checks passed");
