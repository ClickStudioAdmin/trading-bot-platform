import assert from "node:assert/strict";
import {
  CLOSE_ALL_CONFIRM,
  closeAllFlash,
  parseCloseAllConfirm,
} from "./close-all";
import { FUTURES_IDEMPOTENCY_MAX, parseIdempotencyKey } from "./command";

assert.equal(parseIdempotencyKey(null).ok, true);
assert.equal(parseIdempotencyKey("").ok, true);
assert.deepEqual(parseIdempotencyKey("  "), { ok: true, key: null });
assert.deepEqual(parseIdempotencyKey("alert-1"), { ok: true, key: "alert-1" });
assert.equal(parseIdempotencyKey("a".repeat(FUTURES_IDEMPOTENCY_MAX)).ok, true);
assert.equal(parseIdempotencyKey("a".repeat(FUTURES_IDEMPOTENCY_MAX + 1)).ok, false);

assert.equal(CLOSE_ALL_CONFIRM, "CLOSE ALL");
assert.equal(parseCloseAllConfirm("CLOSE ALL").ok, true);
assert.equal(parseCloseAllConfirm(" CLOSE ALL ").ok, true);
assert.equal(parseCloseAllConfirm("close all").ok, false);
assert.equal(parseCloseAllConfirm("").ok, false);
assert.equal(closeAllFlash({ live: false, closedCount: 2 }), "closed-all");
assert.equal(closeAllFlash({ live: true, closedCount: 1 }), "live-closed-all");
assert.equal(closeAllFlash({ live: true, closedCount: 0 }), "cancelled");

console.log("futures command checks passed");
