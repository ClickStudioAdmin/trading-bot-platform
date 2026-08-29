import assert from "node:assert/strict";
import { judgeBybitApiKey } from "./bybit/permissions";
import { bybitSignPayload, hmacSha256Hex } from "./bybit/sign";
import { bybitRestHost, BYBIT_DEMO_REST, BYBIT_PUBLIC_REST } from "./bybit/universe";
import { formatBybitVerifyReject } from "./bybit/verify";
import { venueSupportsVerify } from "./verify";

assert.equal(
  bybitSignPayload({
    timestamp: "1658384314791",
    apiKey: "XXXXXXXXXX",
    recvWindow: "5000",
    query: "category=option&symbol=BTC-29JUL22-25000-C",
  }),
  "1658384314791XXXXXXXXXX5000category=option&symbol=BTC-29JUL22-25000-C",
);
assert.equal(
  hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog"),
  "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
);

assert.equal(bybitRestHost("demo"), BYBIT_DEMO_REST);
assert.equal(bybitRestHost("live"), BYBIT_PUBLIC_REST);
assert.equal(bybitRestHost("mainnet"), BYBIT_PUBLIC_REST);

const tradeOnly = judgeBybitApiKey({
  readOnly: 0,
  permissions: {
    Spot: ["SpotTrade"],
    ContractTrade: ["Order", "Position"],
    Wallet: ["AccountTransfer"],
    Derivatives: ["DerivativesTrade"],
  },
});
assert.equal(tradeOnly.ok, true);

const withdraw = judgeBybitApiKey({
  readOnly: 0,
  permissions: {
    Spot: ["SpotTrade"],
    Wallet: ["AccountTransfer", "Withdraw"],
  },
});
assert.equal(withdraw.ok, false);
if (!withdraw.ok) {
  assert.match(withdraw.error, /withdraw/i);
}

const readOnly = judgeBybitApiKey({
  readOnly: 1,
  permissions: {
    Spot: ["SpotTrade"],
  },
});
assert.equal(readOnly.ok, false);
if (!readOnly.ok) {
  assert.match(readOnly.error, /read-only/i);
}

const noTrade = judgeBybitApiKey({
  readOnly: 0,
  permissions: {
    Wallet: ["AccountTransfer"],
  },
});
assert.equal(noTrade.ok, false);
if (!noTrade.ok) {
  assert.match(noTrade.error, /cannot trade/i);
}

const withdrawBeatsReadOnly = judgeBybitApiKey({
  readOnly: 1,
  permissions: {
    Wallet: ["Withdraw"],
  },
});
assert.equal(withdrawBeatsReadOnly.ok, false);
if (!withdrawBeatsReadOnly.ok) {
  assert.match(withdrawBeatsReadOnly.error, /withdraw/i);
}

assert.equal(venueSupportsVerify("bybit"), true);
assert.equal(venueSupportsVerify("hyperliquid"), true);
assert.equal(venueSupportsVerify("okx"), false);

assert.match(formatBybitVerifyReject(10003, "API key is invalid."), /Demo keys need Environment Demo/);
assert.match(formatBybitVerifyReject(10004, "error sign!"), /API secret/);
assert.match(formatBybitVerifyReject(10010, "Unmatched IP"), /allow list/);
assert.match(formatBybitVerifyReject(33004, "Your api key has expired"), /expired/);

console.log("exchange verify checks passed");
