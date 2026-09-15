import assert from "node:assert/strict";
import {
  alreadyRecordedInvoice,
  applySubscriptionSnapshot,
  invoiceWriteFromPaid,
  isLiveStripeSubscriptionStatus,
  cardUpgradeIntentReady,
  stripeCollectionSyncAction,
  stripeInvoicePaidApplies,
  stripeWebhookAppliesToMember,
  walletStripeWebhookAction,
} from "./stripe-apply";

const paid = invoiceWriteFromPaid({
  invoiceId: "in_1",
  amountPaidCents: 9900,
  periodStart: 1_778_000_000,
  periodEnd: 1_780_600_000,
});
assert.equal(paid.method, "stripe");
assert.equal(paid.externalId, "in_1");
assert.equal(paid.amountUsd, 99);
assert.equal(paid.status, "paid");
assert.ok(paid.periodStart);
assert.ok(paid.periodEnd);
assert.equal(alreadyRecordedInvoice(null), false);
assert.equal(alreadyRecordedInvoice({ status: "paid" }), true);

const active = applySubscriptionSnapshot({
  customerId: "cus_1",
  subscriptionId: "sub_1",
  stripeStatus: "active",
  priceId: "price_1",
  planIdFromPrice: "plan-pro",
  planIdFromMetadata: "plan-other",
  periodEnd: 1_780_600_000,
});
assert.ok(!("ok" in active));
if (!("ok" in active)) {
  assert.equal(active.subscriptionStatus, "active");
  assert.equal(active.planId, "plan-pro");
  assert.equal(active.revertToDefault, false);
}

const pastDue = applySubscriptionSnapshot({
  customerId: "cus_1",
  subscriptionId: "sub_1",
  stripeStatus: "past_due",
  priceId: "price_1",
  planIdFromPrice: "plan-pro",
  planIdFromMetadata: null,
  periodEnd: 1_780_600_000,
});
assert.ok(!("ok" in pastDue));
if (!("ok" in pastDue)) {
  assert.equal(pastDue.subscriptionStatus, "past_due");
  assert.equal(pastDue.planId, "plan-pro");
}

const canceledEnded = applySubscriptionSnapshot({
  customerId: "cus_1",
  subscriptionId: "sub_1",
  stripeStatus: "canceled",
  priceId: "price_1",
  planIdFromPrice: "plan-pro",
  planIdFromMetadata: "plan-pro",
  periodEnd: 1_700_000_000,
  nowMs: 1_780_000_000_000,
});
assert.ok(!("ok" in canceledEnded));
if (!("ok" in canceledEnded)) {
  assert.equal(canceledEnded.revertToDefault, true);
  assert.equal(canceledEnded.subscriptionStatus, "none");
  assert.equal(canceledEnded.planId, null);
}

const canceledOpen = applySubscriptionSnapshot({
  customerId: "cus_1",
  subscriptionId: "sub_1",
  stripeStatus: "canceled",
  priceId: "price_1",
  planIdFromPrice: "plan-pro",
  planIdFromMetadata: null,
  periodEnd: 1_900_000_000,
  nowMs: 1_780_000_000_000,
});
assert.ok(!("ok" in canceledOpen));
if (!("ok" in canceledOpen)) {
  assert.equal(canceledOpen.revertToDefault, false);
  assert.equal(canceledOpen.subscriptionStatus, "canceled");
  assert.equal(canceledOpen.planId, "plan-pro");
}

assert.equal(isLiveStripeSubscriptionStatus("active"), true);
assert.equal(isLiveStripeSubscriptionStatus("past_due"), true);
assert.equal(isLiveStripeSubscriptionStatus("trialing"), true);
assert.equal(isLiveStripeSubscriptionStatus("canceled"), false);
assert.equal(isLiveStripeSubscriptionStatus("incomplete_expired"), false);
assert.equal(
  stripeCollectionSyncAction({ method: "wallet", stripeStatus: "active" }),
  "cancel_at_period_end",
);
assert.equal(
  stripeCollectionSyncAction({ method: "stripe", stripeStatus: "active" }),
  "resume",
);
assert.equal(
  stripeCollectionSyncAction({ method: "stripe", stripeStatus: "canceled" }),
  "recreate",
);
assert.equal(
  stripeCollectionSyncAction({ method: "stripe", stripeStatus: null }),
  "recreate",
);
assert.equal(
  stripeCollectionSyncAction({ method: "wallet", stripeStatus: "canceled" }),
  "none",
);
if ("ok" in active || "ok" in canceledEnded || "ok" in canceledOpen) {
  throw new Error("expected subscription snapshots");
}
assert.equal(walletStripeWebhookAction(active), "ignore");
assert.equal(walletStripeWebhookAction(canceledEnded), "clear_subscription");
assert.equal(walletStripeWebhookAction(canceledOpen), "clear_subscription");
assert.equal(
  stripeWebhookAppliesToMember({
    billingMethod: "wallet",
    applied: active,
  }),
  false,
);
assert.equal(
  stripeWebhookAppliesToMember({
    billingMethod: "stripe",
    applied: canceledEnded,
  }),
  true,
);
assert.equal(stripeInvoicePaidApplies("wallet"), false);
assert.equal(stripeInvoicePaidApplies("stripe"), true);
assert.equal(cardUpgradeIntentReady("succeeded"), true);
assert.equal(cardUpgradeIntentReady("requires_action"), false);

console.log("membership stripe-apply checks passed");
