import assert from "node:assert/strict";
import {
  billingPath,
  checkoutPath,
  decideUpgrade,
  embeddedCheckoutReturnUrl,
  formatUsd,
  hasUsableStripeSubscription,
  parseBillingMethod,
  parsePaySubscriptionFromCredit,
  stripeCentsToUsd,
  walletEntryDelta,
} from "./billing";

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
assert.equal(checkoutPath(), "/account/billing/checkout");
assert.equal(
  checkoutPath({ plan: "plan-1", error: "Nope" }),
  "/account/billing/checkout?plan=plan-1&error=Nope",
);
assert.equal(stripeCentsToUsd(9900), 99);
assert.equal(stripeCentsToUsd(199), 1.99);
assert.equal(formatUsd(99), "$99");
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

console.log("membership billing checks passed");
