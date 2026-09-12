import {
  mapStripeSubscriptionStatus,
  stripeCentsToUsd,
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
