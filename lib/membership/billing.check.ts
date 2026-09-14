import assert from "node:assert/strict";
import {
  billingPath,
  checkoutCharge,
  checkoutPath,
  decideUpgrade,
  isPaidCycleUpgrade,
  prorateUpgradeUsd,
  embeddedCardReturnUrl,
  embeddedCheckoutReturnUrl,
  formatCount,
  formatRemainingCycle,
  formatUsd,
  resolveBillingCycle,
  invoiceMethodLabel,
  hasUsableStripeSubscription,
  parseBillingMethod,
  parsePaySubscriptionFromCredit,
  stripeCentsToUsd,
  walletEntryDelta,
} from "./billing";

assert.equal(invoiceMethodLabel("stripe"), "Card");
assert.equal(invoiceMethodLabel("wallet"), "Crypto");
assert.equal(invoiceMethodLabel("comp"), "Comp");
assert.equal(parseBillingMethod("stripe"), "stripe");
assert.equal(parseBillingMethod("wallet"), "wallet");
assert.equal(parseBillingMethod("comp"), null);
assert.equal(parsePaySubscriptionFromCredit("1"), true);
assert.equal(parsePaySubscriptionFromCredit("on"), false);
assert.equal(parsePaySubscriptionFromCredit(null), false);
assert.equal(
  embeddedCheckoutReturnUrl("https://app.example/"),
  "https://app.example/account/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}",
);
assert.equal(
  embeddedCardReturnUrl("https://app.example/"),
  "https://app.example/account/billing?tab=card&saved=card&session_id={CHECKOUT_SESSION_ID}",
);
assert.equal(
  hasUsableStripeSubscription({
    stripeSubscriptionId: "sub_1",
    subscriptionStatus: "active",
  }),
  true,
);
assert.equal(
  hasUsableStripeSubscription({
    stripeSubscriptionId: null,
    subscriptionStatus: "comp",
  }),
  false,
);
assert.equal(billingPath(), "/account/billing");
assert.equal(
  billingPath({ tab: "wallet", saved: "withdraw" }),
  "/account/billing?tab=wallet&saved=withdraw",
);
assert.equal(checkoutPath(), "/account/billing/checkout");
assert.equal(
  checkoutPath({ plan: "plan-1", error: "Nope" }),
  "/account/billing/checkout?plan=plan-1&error=Nope",
);
assert.equal(stripeCentsToUsd(9900), 99);
assert.equal(stripeCentsToUsd(199), 1.99);
assert.equal(formatUsd(99), "$99");
assert.equal(formatUsd(37088), "$37,088");
assert.equal(formatUsd(11.78), "$11.78");
assert.equal(formatCount(3905), "3,905");
assert.equal(formatCount(10000), "10,000");
assert.equal(walletEntryDelta("deposit", 10), 10);
assert.equal(walletEntryDelta("withdraw", 10), -10);
assert.equal(walletEntryDelta("debit_rent", -25), -25);
assert.equal(walletEntryDelta("adjust", -3), -3);
assert.equal(walletEntryDelta("transfer_in", 4), 4);
assert.equal(walletEntryDelta("transfer_out", 4), -4);

const paid = {
  id: "p1",
  priceUsd: 99,
  stripePriceId: "price_1",
  archivedAt: null,
  visibility: "public" as const,
};
assert.equal(
  decideUpgrade({ currentPlanId: "p1", target: paid, method: "stripe" }).kind,
  "current",
);
assert.equal(
  decideUpgrade({ currentPlanId: "free", target: paid, method: null }).kind,
  "need_method",
);
assert.equal(
  decideUpgrade({ currentPlanId: "free", target: paid, method: "wallet" }).kind,
  "wallet_shell",
);
assert.equal(
  decideUpgrade({ currentPlanId: "free", target: paid, method: "stripe" }).kind,
  "checkout",
);
assert.equal(
  decideUpgrade({
    currentPlanId: "free",
    target: { ...paid, stripePriceId: null },
    method: "stripe",
  }).kind,
  "reject",
);
assert.equal(
  decideUpgrade({
    currentPlanId: "free",
    target: { ...paid, archivedAt: "2026-09-12T00:00:00.000Z" },
    method: "stripe",
  }).kind,
  "reject",
);
assert.equal(
  decideUpgrade({
    currentPlanId: "free",
    target: { ...paid, visibility: "draft" },
    method: "stripe",
  }).kind,
  "reject",
);

const now = 1_779_000_000_000;
const inFifteenDays = new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString();
assert.equal(
  isPaidCycleUpgrade({
    currentPriceUsd: 19,
    targetPriceUsd: 49,
    periodEnd: inFifteenDays,
    nowMs: now,
  }),
  true,
);
assert.equal(
  isPaidCycleUpgrade({
    currentPriceUsd: 0,
    targetPriceUsd: 19,
    periodEnd: inFifteenDays,
    nowMs: now,
  }),
  false,
);
assert.equal(
  isPaidCycleUpgrade({
    currentPriceUsd: 19,
    targetPriceUsd: 49,
    periodEnd: null,
  }),
  true,
);
assert.equal(
  prorateUpgradeUsd({
    oldPriceUsd: 19,
    newPriceUsd: 49,
    periodEnd: inFifteenDays,
    nowMs: now,
  }),
  15,
);
assert.deepEqual(
  checkoutCharge({
    currentPriceUsd: 0,
    targetPriceUsd: 19,
    periodEnd: inFifteenDays,
    nowMs: now,
  }),
  { kind: "initial", dueUsd: 19 },
);
assert.deepEqual(
  checkoutCharge({
    currentPriceUsd: 19,
    targetPriceUsd: 49,
    periodEnd: inFifteenDays,
    nowMs: now,
  }),
  { kind: "upgrade", dueUsd: 15, periodEnd: inFifteenDays, basis: "prorate" },
);
assert.deepEqual(
  checkoutCharge({
    currentPriceUsd: 19,
    targetPriceUsd: 49,
    periodEnd: null,
    nowMs: now,
  }),
  {
    kind: "upgrade",
    dueUsd: 30,
    periodEnd: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
    basis: "delta",
  },
);

const cycle = resolveBillingCycle({
  periodEnd: inFifteenDays,
  nowMs: now,
});
assert.ok(cycle);
assert.equal(cycle.remainingMs, 15 * 24 * 60 * 60 * 1000);
assert.equal(formatRemainingCycle(15 * 24 * 60 * 60 * 1000), "15 days left");
assert.equal(formatRemainingCycle(0), "Ended");
assert.equal(resolveBillingCycle({ periodEnd: null }), null);

console.log("membership billing checks passed");
