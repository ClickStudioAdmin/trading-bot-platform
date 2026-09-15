import {
  mapStripeSubscriptionStatus,
  stripeCentsToUsd,
  type BillingMethod,
  type InvoiceStatus,
  type SubscriptionStatus,
} from "./billing";

export type StripeInvoiceWrite = {
  method: "stripe";
  externalId: string;
  amountUsd: number;
  status: InvoiceStatus;
  periodStart: string | null;
  periodEnd: string | null;
};

export type AppliedSubscription = {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  planId: string | null;
  subscriptionStatus: Exclude<SubscriptionStatus, "comp">;
  periodEnd: string | null;
  revertToDefault: boolean;
};

export function invoiceWriteFromPaid(input: {
  invoiceId: string;
  amountPaidCents: number;
  periodStart: number | null;
  periodEnd: number | null;
}): StripeInvoiceWrite {
  return {
    method: "stripe",
    externalId: input.invoiceId,
    amountUsd: stripeCentsToUsd(input.amountPaidCents),
    status: "paid",
    periodStart: unixToIso(input.periodStart),
    periodEnd: unixToIso(input.periodEnd),
  };
}

export function alreadyRecordedInvoice(
  existing: { status: InvoiceStatus } | null,
): boolean {
  return existing !== null;
}

export function isLiveStripeSubscriptionStatus(status: string): boolean {
  const mapped = mapStripeSubscriptionStatus(status);
  return mapped === "active" || mapped === "past_due";
}

export type StripeCollectionSyncAction =
  | "cancel_at_period_end"
  | "resume"
  | "recreate"
  | "none";

/** How Save should talk to Stripe before writing Card / Crypto. */
export function stripeCollectionSyncAction(input: {
  method: "stripe" | "wallet";
  stripeStatus: string | null;
}): StripeCollectionSyncAction {
  const live =
    input.stripeStatus !== null &&
    isLiveStripeSubscriptionStatus(input.stripeStatus);
  if (input.method === "wallet") {
    return live ? "cancel_at_period_end" : "none";
  }
  return live ? "resume" : "recreate";
}

export type WalletStripeWebhookAction = "ignore" | "clear_subscription";

/** Crypto collection owns plan and method. Stripe may only drop a dead sub id. */
export function walletStripeWebhookAction(
  applied: AppliedSubscription,
): WalletStripeWebhookAction {
  if (
    applied.revertToDefault ||
    applied.subscriptionStatus === "canceled" ||
    applied.subscriptionStatus === "none"
  ) {
    return "clear_subscription";
  }
  return "ignore";
}

export function stripeWebhookAppliesToMember(input: {
  billingMethod: BillingMethod | null;
  applied: AppliedSubscription;
}): boolean {
  return input.billingMethod !== "wallet";
}

export function applySubscriptionSnapshot(input: {
  customerId: string;
  subscriptionId: string | null;
  stripeStatus: string;
  priceId: string | null;
  planIdFromPrice: string | null;
  planIdFromMetadata: string | null;
  periodEnd: number | null;
  nowMs?: number;
}): AppliedSubscription | { ok: false; error: string } {
  const status = mapStripeSubscriptionStatus(input.stripeStatus);
  if (!status) {
    return { ok: false, error: `Unhandled Stripe status ${input.stripeStatus}.` };
  }
  const periodEnd = unixToIso(input.periodEnd);
  const now = input.nowMs ?? Date.now();
  const ended = !periodEnd || Date.parse(periodEnd) <= now;
  const revertToDefault = status === "canceled" && ended;
  return {
    stripeCustomerId: input.customerId,
    stripeSubscriptionId: input.subscriptionId,
    planId: revertToDefault
      ? null
      : input.planIdFromPrice ?? input.planIdFromMetadata,
    subscriptionStatus: revertToDefault ? "none" : status,
    periodEnd,
    revertToDefault,
  };
}

function unixToIso(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}
