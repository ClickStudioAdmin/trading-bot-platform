import assert from "node:assert/strict";
import { bybitPublicCallShouldRetry } from "@/lib/exchanges/bybit/client";
import { backtestFailureMessage } from "./failure";

assert.equal(backtestFailureMessage(new Error("")), "Replay failed.");
assert.equal(backtestFailureMessage("  "), "Replay failed.");
assert.equal(
  backtestFailureMessage(new Error("Bybit HTTP 429 on /v5/market/kline")),
  "Bybit HTTP 429 on /v5/market/kline",
);
assert.equal(
  backtestFailureMessage(new Error("Bybit /v5/market/kline: Too many visits")),
  "Bybit /v5/market/kline: Too many visits",
);
assert.equal(backtestFailureMessage(new Error("line one\nstack")).length, 8);
assert.equal(
  backtestFailureMessage(new Error("x".repeat(400))).length,
  180,
);
assert.equal(
  backtestFailureMessage(new Error("x".repeat(400))).endsWith("…"),
  true,
);

assert.equal(bybitPublicCallShouldRetry({ httpStatus: 429 }), true);
assert.equal(bybitPublicCallShouldRetry({ httpStatus: 503 }), true);
assert.equal(bybitPublicCallShouldRetry({ httpStatus: 403 }), false);
assert.equal(bybitPublicCallShouldRetry({ httpStatus: 400 }), false);
assert.equal(bybitPublicCallShouldRetry({ retCode: 10006 }), true);
assert.equal(bybitPublicCallShouldRetry({ retCode: 10018 }), true);
assert.equal(
  bybitPublicCallShouldRetry({ retCode: 10001, retMsg: "params error" }),
  false,
);
assert.equal(bybitPublicCallShouldRetry({ networkError: true }), true);
assert.equal(
  bybitPublicCallShouldRetry({ retMsg: "Too many visits" }),
  true,
);
