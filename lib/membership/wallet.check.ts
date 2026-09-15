import assert from "node:assert/strict";
import {
  bookBalancesFromEntries,
  mainWalletLedgerLabel,
  parseWalletMinPayout,
  planDeductDecision,
  ACCOUNT_UPGRADE_DEPOSIT_NOTE,
  accountBalanceCoversNextCycle,
  accountShortfallUsd,
  checkoutPartialCreditNotice,
  creditedDepositsNotice,
  depositCreditIsFresh,
  methodTopUpNote,
  methodTopUpShortfall,
  showMemberLedgerTab,
  showMemberWalletTab,
  tokenAmountToUsd,
  walletEntryDelta,
  walletInvoiceExternalId,
  walletUpgradeInvoiceExternalId,
  withRunningBalances,
} from "./wallet";

assert.equal(accountShortfallUsd(29.99, 15), 14.99);
assert.equal(accountShortfallUsd(29.99, 29.99), 0);
assert.equal(
  methodTopUpNote(19).startsWith(
    "Ensure you always maintain enough account balance to pay for your next month's subscription payment ($19).",
  ),
  true,
);
assert.equal(
  ACCOUNT_UPGRADE_DEPOSIT_NOTE.startsWith(
    "Transfer at least the account shortfall to cover today's payment.",
  ),
  true,
);
assert.equal(
  methodTopUpShortfall(19),
  "Your account balance doesn't have enough funds to cover your next billing cycle ($19).",
);
assert.equal(
  methodTopUpShortfall(19.5),
  "Your account balance doesn't have enough funds to cover your next billing cycle ($19.50).",
);
assert.equal(creditedDepositsNotice(1), "Credited 1 deposit to Account Balance.");
assert.equal(creditedDepositsNotice(3), "Credited 3 deposits to Account Balance.");
assert.equal(
  checkoutPartialCreditNotice("$19.99"),
  "Deposit added to account balance. Shortfall of $19.99 still required for payment.",
);
assert.equal(depositCreditIsFresh("2026-09-15T02:00:00.000Z", Date.parse("2026-09-15T02:00:01.000Z")), true);
assert.equal(depositCreditIsFresh("2026-09-15T01:00:00.000Z", Date.parse("2026-09-15T02:00:00.000Z")), false);

assert.equal(accountBalanceCoversNextCycle(19, 19), true);
assert.equal(accountBalanceCoversNextCycle(18.99, 19), false);
assert.equal(accountBalanceCoversNextCycle(0, 0), true);

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
assert.equal(
  walletUpgradeInvoiceExternalId(
    "user-1",
    "plan-2",
    "2026-10-01T00:00:00.000Z",
  ),
  "wallet-upgrade:user-1:plan-2:2026-10-01T00:00:00.000Z",
);

assert.deepEqual(parseWalletMinPayout(100), { ok: true, usd: 100 });
assert.equal(parseWalletMinPayout(-1).ok, false);
assert.equal(showMemberWalletTab("wallet", 0), true);
assert.equal(showMemberWalletTab("stripe", 0), false);
assert.equal(showMemberWalletTab("stripe", 0.004), false);
assert.equal(showMemberWalletTab("stripe", 0.01), true);
assert.equal(showMemberWalletTab("stripe", 50), true);

assert.equal(showMemberLedgerTab(0, false), false);
assert.equal(showMemberLedgerTab(0, true), true);
assert.equal(showMemberLedgerTab(0.004, false), false);
assert.equal(showMemberLedgerTab(19, false), true);
assert.equal(showMemberLedgerTab(19, true), true);
assert.equal(mainWalletLedgerLabel("deposit"), "Deposit");
assert.equal(mainWalletLedgerLabel("debit_rent"), "Plan payment");
assert.equal(
  mainWalletLedgerLabel("transfer_in"),
  "Transfer from Affiliate",
);
assert.equal(
  mainWalletLedgerLabel("transfer_out"),
  "Transfer to Account Balance",
);
assert.equal(mainWalletLedgerLabel("withdraw"), "Withdrawal");
assert.equal(
  mainWalletLedgerLabel("withdraw", "USDT withdraw requested"),
  "Withdrawal",
);
assert.equal(
  mainWalletLedgerLabel("adjust", "USDT withdraw rejected"),
  "USDT withdraw rejected",
);
assert.deepEqual(
  withRunningBalances([
    { kind: "deposit", amountUsd: 100 },
    { kind: "transfer_in", amountUsd: 25 },
    { kind: "debit_rent", amountUsd: 40 },
    { kind: "withdraw", amountUsd: 30 },
  ]).map((row) => row.balanceUsd),
  [100, 125, 85, 55],
);

console.log("membership wallet checks passed");
