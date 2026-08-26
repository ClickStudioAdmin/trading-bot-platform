import assert from "node:assert/strict";
import {
  generateWebhookToken,
  hashWebhookToken,
  isWebhookTokenShape,
  looksLikeVenueWebhookPayload,
  parseFuturesWebhook,
  parseWebhookJson,
  parseWebhookKind,
  parseWebhookName,
  webhookTokensMatch,
} from "./webhook";
import {
  decryptWebhookToken,
  encryptWebhookToken,
} from "./webhook-secret";

const buy = parseFuturesWebhook({
  action: "buy",
  symbol: "btcusdt",
  size: "0.001",
  sizeUnit: "qty",
  id: "alert-1",
});
assert.equal(buy.ok, true);
if (buy.ok && buy.parsed.kind === "order") {
  assert.equal(buy.parsed.action, "buy");
  assert.equal(buy.parsed.symbol, "BTCUSDT");
  assert.equal(buy.parsed.idempotencyKey, "alert-1");
} else {
  assert.fail("buy should parse as an order");
}

const closeLong = parseFuturesWebhook({
  action: "close_long",
  symbol: "BTCUSDT",
});
assert.equal(closeLong.ok, true);
if (closeLong.ok && closeLong.parsed.kind === "order") {
  assert.equal(closeLong.parsed.action, "flatten");
  assert.equal(closeLong.parsed.closeSide, "long");
} else {
  assert.fail("close_long should parse as flatten long");
}

const arm = parseFuturesWebhook({ action: "arm" });
assert.equal(arm.ok, true);
if (arm.ok) {
  assert.equal(arm.parsed.kind, "arm");
  if (arm.parsed.kind === "arm") {
    assert.equal(arm.parsed.verb, "arm");
  }
}

const closePlaybook = parseFuturesWebhook({ action: "close-playbook" });
assert.equal(closePlaybook.ok, true);
if (closePlaybook.ok && closePlaybook.parsed.kind === "arm") {
  assert.equal(closePlaybook.parsed.verb, "close-playbook");
}

assert.equal(parseWebhookName("BTC scalp").ok, true);
assert.equal(parseWebhookName("").ok, false);
assert.equal(parseWebhookKind("signal").ok, true);
assert.equal(parseWebhookKind("other").ok, false);

assert.equal(parseFuturesWebhook({ action: "flip", symbol: "BTCUSDT" }).ok, false);
assert.equal(
  parseFuturesWebhook({ action: "buy", symbol: "BTCUSDT" }).ok,
  false,
);

assert.equal(
  looksLikeVenueWebhookPayload({ retCode: 0, result: { orderId: "1" } }),
  true,
);
assert.equal(
  parseFuturesWebhook({ retCode: 0, result: { orderId: "1" } }).ok,
  false,
);

const longId = parseFuturesWebhook({
  action: "sell",
  symbol: "ETHUSDT",
  size: "100",
  sizeUnit: "usdt",
  id: "BTCUSDT-2026-08-26T04:55:00.000Z-extra",
});
assert.equal(longId.ok, true);
if (longId.ok && longId.parsed.kind === "order") {
  assert.equal(longId.parsed.idempotencyKey?.length, 32);
}

const fromText = parseWebhookJson('{"action":"disarm"}');
assert.equal(fromText.ok, true);
if (fromText.ok) {
  const parsed = parseFuturesWebhook(fromText.body);
  assert.equal(parsed.ok, true);
}

const token = generateWebhookToken();
assert.equal(isWebhookTokenShape(token), true);
assert.equal(isWebhookTokenShape("nope"), false);
assert.equal(hashWebhookToken(token).length, 64);
assert.equal(webhookTokensMatch(hashWebhookToken(token), hashWebhookToken(token)), true);
assert.equal(webhookTokensMatch("aa", "bb"), false);

const previous = process.env.EXCHANGE_CREDENTIALS_KEY;
process.env.EXCHANGE_CREDENTIALS_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const sealed = encryptWebhookToken(token);
assert.equal(decryptWebhookToken(sealed.ciphertext, sealed.nonce), token);
process.env.EXCHANGE_CREDENTIALS_KEY = previous;

console.log("futures webhook checks passed");
