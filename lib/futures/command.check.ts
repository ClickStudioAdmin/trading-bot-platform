import assert from "node:assert/strict";
import { FUTURES_IDEMPOTENCY_MAX, parseIdempotencyKey } from "./command";

assert.equal(parseIdempotencyKey(null).ok, true);
assert.equal(parseIdempotencyKey("").ok, true);
assert.deepEqual(parseIdempotencyKey("  "), { ok: true, key: null });
assert.deepEqual(parseIdempotencyKey("alert-1"), { ok: true, key: "alert-1" });
assert.equal(parseIdempotencyKey("a".repeat(FUTURES_IDEMPOTENCY_MAX)).ok, true);
assert.equal(parseIdempotencyKey("a".repeat(FUTURES_IDEMPOTENCY_MAX + 1)).ok, false);

console.log("futures command checks passed");
