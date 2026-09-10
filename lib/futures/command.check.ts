import assert from "node:assert/strict";
import {
  CANCEL_ALL_CONFIRM,
  CLOSE_ALL_CONFIRM,
  closeAllBlockNewSizeCopy,
  closeAllExtraBody,
  closeAllFlash,
  closeAllScopeBody,
  parseCloseAllConfirm,
  parseCloseAllScope,
  parseSetReduceOnly,
} from "./close-all";
import {
  FUTURES_IDEMPOTENCY_MAX,
  commandReceiptReplay,
  idempotencyWorkingReplay,
  parseIdempotencyKey,
} from "./command";

assert.equal(parseIdempotencyKey(null).ok, true);
assert.equal(parseIdempotencyKey("").ok, true);
assert.deepEqual(parseIdempotencyKey("  "), { ok: true, key: null });
assert.deepEqual(parseIdempotencyKey("alert-1"), { ok: true, key: "alert-1" });
assert.equal(parseIdempotencyKey("a".repeat(FUTURES_IDEMPOTENCY_MAX)).ok, true);
assert.equal(parseIdempotencyKey("a".repeat(FUTURES_IDEMPOTENCY_MAX + 1)).ok, false);
assert.equal(idempotencyWorkingReplay("open"), "replay");
assert.equal(idempotencyWorkingReplay("filled"), "replay");
assert.equal(idempotencyWorkingReplay("cancelled"), "new");
assert.equal(idempotencyWorkingReplay("rejected"), "new");
assert.equal(idempotencyWorkingReplay(null), "new");
assert.equal(commandReceiptReplay("working"), "new");
assert.equal(commandReceiptReplay("live-working"), "new");
assert.equal(commandReceiptReplay("closed"), "replay");
assert.equal(commandReceiptReplay("live-closed"), "replay");
assert.equal(commandReceiptReplay("opened"), "replay");

assert.equal(CLOSE_ALL_CONFIRM, "CLOSE ALL");
assert.equal(CANCEL_ALL_CONFIRM, "CANCEL ALL");
assert.equal(parseCloseAllScope("positions").ok, true);
assert.equal(parseCloseAllScope("orders").ok, true);
assert.equal(parseCloseAllScope("all").ok, true);
assert.equal(parseCloseAllScope("").ok, false);
assert.equal(parseCloseAllConfirm("CLOSE ALL", "positions").ok, true);
assert.equal(parseCloseAllConfirm(" CLOSE ALL ", "all").ok, true);
assert.equal(parseCloseAllConfirm("CANCEL ALL", "orders").ok, true);
assert.equal(parseCloseAllConfirm("CLOSE ALL", "orders").ok, false);
assert.equal(parseCloseAllConfirm("close all", "positions").ok, false);
assert.equal(parseCloseAllConfirm("", "all").ok, false);
assert.equal(parseSetReduceOnly("on"), true);
assert.equal(parseSetReduceOnly("true"), true);
assert.equal(parseSetReduceOnly(""), false);
assert.equal(parseSetReduceOnly("off"), false);
assert.equal(
  closeAllFlash({ live: false, closedCount: 2, cancelledCount: 0 }),
  "closed-all",
);
assert.equal(
  closeAllFlash({ live: true, closedCount: 1, cancelledCount: 0 }),
  "live-closed-all",
);
assert.equal(
  closeAllFlash({ live: false, closedCount: 1, cancelledCount: 2 }),
  "closed-and-cancelled",
);
assert.equal(
  closeAllFlash({ live: true, closedCount: 0, cancelledCount: 3 }),
  "cancelled-all",
);
assert.match(closeAllScopeBody("all"), /Closing \/ Cancelling/);
assert.match(closeAllScopeBody("all"), /cannot be undone/);
assert.equal(closeAllScopeBody("all").includes("then market-closes"), false);
assert.match(
  closeAllExtraBody({ dcaDesk: true }) ?? "",
  /stays Active/,
);
assert.match(
  closeAllExtraBody({ dcaDesk: true }) ?? "",
  /Stop adding or Disable/,
);
assert.equal(closeAllExtraBody({ dcaDesk: true })?.includes("Reduce only"), false);
assert.equal(closeAllExtraBody({}), null);
assert.equal(closeAllBlockNewSizeCopy({ dcaDesk: true }).label, "Block new clips");
assert.match(
  closeAllBlockNewSizeCopy({ dcaDesk: true }).hint,
  /Desk Settings/,
);
assert.equal(
  closeAllBlockNewSizeCopy({ dcaDesk: true }).hint.includes(
    "Active automation rules",
  ),
  false,
);
assert.equal(closeAllBlockNewSizeCopy({}).label, "Set reduce only");

console.log("futures command checks passed");
