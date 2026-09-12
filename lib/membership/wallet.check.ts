import assert from "node:assert/strict";
import {
  bookBalancesFromEntries,
  planDeductDecision,
  tokenAmountToUsd,
  walletEntryDelta,
  walletInvoiceExternalId,
} from "./wallet";

assert.equal(walletEntryDelta("deposit", 10), 10);
assert.equal(walletEntryDelta("commission", 4), 4);
assert.equal(walletEntryDelta("transfer_in", 7.5), 7.5);
assert.equal(walletEntryDelta("transfer_out", 7.5), -7.5);
assert.equal(walletEntryDelta("debit_rent", -25), -25);
assert.equal(walletEntryDelta("withdraw", 10), -10);
assert.equal(walletEntryDelta("adjust", -3), -3);

assert.deepEqual(
  bookBalancesFromEntries([
    { kind: "deposit", amountUsd: 20, book: "main" },
    { kind: "commission", amountUsd: 8, book: "affiliate" },
    { kind: "transfer_out", amountUsd: 3, book: "affiliate" },
    { kind: "transfer_in", amountUsd: 3, book: "main" },
    { kind: "debit_rent", amountUsd: 10, book: "main" },
  ]),
  { main: 13, affiliate: 5 },
);

assert.deepEqual(
  planDeductDecision({
    priceUsd: 10,
    mainUsd: 12,
    affiliateUsd: 0,
    useAffiliate: false,
  }),
  { ok: true, transferUsd: 0 },
);
assert.deepEqual(
  planDeductDecision({
    priceUsd: 10,
    mainUsd: 6,
    affiliateUsd: 8,
    useAffiliate: true,
  }),
  { ok: true, transferUsd: 4 },
);
assert.deepEqual(
  planDeductDecision({
    priceUsd: 10,
    mainUsd: 6,
    affiliateUsd: 8,
    useAffiliate: false,
  }),
  { ok: false, shortUsd: 4 },
);
assert.equal(tokenAmountToUsd(BigInt(10000000), 6, "stable"), 10);
assert.equal(tokenAmountToUsd(BigInt(4), 6, "stable"), null);
assert.equal(tokenAmountToUsd(BigInt(10000000), 6, "wbtc"), null);
assert.equal(
  walletInvoiceExternalId("user-1", "2026-09-12T00:00:00.000Z"),
  "wallet:user-1:2026-09-12T00:00:00.000Z",
);

console.log("membership wallet checks passed");
