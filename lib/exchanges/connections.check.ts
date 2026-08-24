import assert from "node:assert/strict";
import {
  formatConnectionSummary,
  formatEnvironmentLabel,
  formatVenueLabel,
  keyFingerprint,
  parseConnectionLabel,
  parseExchangeConnectionRow,
  toByteaParam,
} from "./connections";
import { parseVenueId } from "./venues";

const bybit = parseVenueId("bybit");
assert.equal(bybit.ok, true);
if (!bybit.ok) {
  throw new Error("bybit should parse");
}

assert.equal(
  keyFingerprint({ apiKey: "ABCD1234", apiSecret: "nope" }, bybit.venue),
  "1234",
);
assert.equal(
  keyFingerprint({ apiKey: "abc", apiSecret: "nope" }, bybit.venue),
  null,
);

assert.deepEqual(parseConnectionLabel(""), { ok: true, label: null });
assert.deepEqual(parseConnectionLabel("  Desk  "), {
  ok: true,
  label: "Desk",
});
assert.equal(parseConnectionLabel("x".repeat(41)).ok, false);

assert.equal(formatVenueLabel("bybit"), "Bybit");
assert.equal(formatVenueLabel("okx"), "okx");
assert.equal(formatEnvironmentLabel("bybit", "demo"), "Demo");
assert.equal(formatEnvironmentLabel("bybit", "live"), "Live");
assert.equal(formatEnvironmentLabel("bybit", "production"), "Live");
assert.equal(formatEnvironmentLabel("bybit", "mainnet"), "Live");

const row = parseExchangeConnectionRow({
  id: "conn-1",
  account_id: "acc-1",
  venue: "bybit",
  environment: "live",
  label: null,
  key_fingerprint: "1234",
  status: "active",
  verified_at: null,
  created_at: "2026-08-24T00:00:00.000Z",
});
assert.equal(row?.fingerprint, "1234");
assert.equal(row?.verifiedAtMs, null);
assert.equal(
  formatConnectionSummary(row!),
  "Bybit Live · ••••1234",
);
assert.equal(parseExchangeConnectionRow({}), null);

assert.equal(toByteaParam(Buffer.from("ab")), "\\x6162");

console.log("exchange connection checks passed");
