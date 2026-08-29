import assert from "node:assert/strict";
import {
  formatConnectionSummary,
  formatDeskBindLabel,
  formatDeskBindType,
  formatEnvironmentLabel,
  formatStrategyConnectionCaption,
  formatVenueLabel,
  keyFingerprint,
  parseBoundConnectionId,
  connectionIdsBoundToOtherDesks,
  sharedKeyWarningKind,
  parseConnectionLabel,
  parseExchangeConnectionRow,
  fromByteaParam,
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
const hl = parseVenueId("hyperliquid");
assert.equal(hl.ok, true);
if (hl.ok) {
  assert.equal(
    keyFingerprint(
      {
        accountAddress: "0x1111111111111111111111111111111111111111",
        agentKey:
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      },
      hl.venue,
    ),
    "2266",
  );
}
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
assert.equal(
  formatEnvironmentLabel("hyperliquid", "demo"),
  "Demo (Hyperliquid Testnet)",
);
assert.equal(formatVenueLabel("hyperliquid"), "Hyperliquid");

assert.equal(parseBoundConnectionId(""), null);
assert.equal(parseBoundConnectionId("none"), null);
assert.equal(parseBoundConnectionId("  conn-1  "), "conn-1");
assert.deepEqual(
  connectionIdsBoundToOtherDesks(
    [
      { connectionId: "k1", accountId: "a" },
      { connectionId: "k1", accountId: "b" },
      { connectionId: "k2", accountId: "a" },
    ],
    "a",
  ),
  ["k1"],
);
assert.deepEqual(
  connectionIdsBoundToOtherDesks(
    [{ connectionId: "k1", accountId: "a" }],
  ),
  ["k1"],
);
assert.deepEqual(
  connectionIdsBoundToOtherDesks(
    [{ connectionId: "k1", accountId: "a" }],
    "a",
  ),
  [],
);
assert.deepEqual(connectionIdsBoundToOtherDesks([]), []);
assert.equal(
  sharedKeyWarningKind({
    connectionId: "k1",
    sharedConnectionIds: ["k1"],
  }),
  "pending",
);
assert.equal(
  sharedKeyWarningKind({
    connectionId: "k1",
    savedConnectionId: "k1",
    sharedConnectionIds: ["k1"],
  }),
  "shared",
);
assert.equal(
  sharedKeyWarningKind({
    connectionId: "k2",
    savedConnectionId: "k1",
    sharedConnectionIds: ["k2"],
  }),
  "pending",
);
assert.equal(
  sharedKeyWarningKind({
    connectionId: "k1",
    savedConnectionId: "k1",
    sharedConnectionIds: [],
  }),
  null,
);
assert.equal(
  sharedKeyWarningKind({
    connectionId: "none",
    sharedConnectionIds: ["k1"],
  }),
  null,
);
assert.equal(
  formatDeskBindLabel({
    accountName: "Demo Account",
    strategy: "cash_and_carry",
  }),
  "Demo Account · Cash and Carry",
);
assert.equal(
  formatDeskBindLabel({ accountName: "Perps Live", strategy: "futures" }),
  "Perps Live · Futures",
);
assert.equal(formatDeskBindType("cash_and_carry"), "Cash and Carry");
assert.equal(formatDeskBindType("futures"), "Futures");

const row = parseExchangeConnectionRow({
  id: "conn-1",
  user_id: "user-1",
  venue: "bybit",
  environment: "live",
  label: null,
  key_fingerprint: "1234",
  status: "active",
  verified_at: null,
  created_at: "2026-08-24T00:00:00.000Z",
});
assert.equal(row?.fingerprint, "1234");
assert.equal(row?.userId, "user-1");
assert.equal(row?.verifiedAtMs, null);
assert.equal(
  formatConnectionSummary(row!),
  "Bybit Live · ••••1234",
);
assert.deepEqual(formatStrategyConnectionCaption(row!), {
  name: "Bybit",
  venue: null,
});
assert.deepEqual(
  formatStrategyConnectionCaption({
    ...row!,
    environment: "demo",
    label: "TBP ByBit Demo",
  }),
  { name: "TBP ByBit Demo", venue: "Bybit" },
);
assert.equal(
  parseExchangeConnectionRow({
    id: "conn-2",
    user_id: "user-1",
    venue: "bybit",
    environment: "demo",
    label: "Desk",
    key_fingerprint: "9876",
    status: "active",
    verified_at: "2026-08-25T00:00:00.000Z",
    created_at: "2026-08-25T00:00:00.000Z",
  })?.verifiedAtMs,
  Date.parse("2026-08-25T00:00:00.000Z"),
);
assert.equal(parseExchangeConnectionRow({}), null);

assert.equal(toByteaParam(Buffer.from("ab")), "\\x6162");
assert.deepEqual(fromByteaParam("\\x6162"), Buffer.from("ab"));

console.log("exchange connection checks passed");
