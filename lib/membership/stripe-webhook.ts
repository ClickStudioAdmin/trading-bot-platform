import { writeEventLog } from "@/lib/logs/write";
import type Stripe from "stripe";
import {
  applyMemberSubscription,
  getMemberBilling,
  getMemberBillingByCustomer,
  markStripeInvoiceRefunded,
  recordStripeInvoice,
  saveStripeCustomerIds,
} from "./billing-store";
import { getMembershipPlanByStripePriceId } from "./store";
import { getStripe } from "./stripe";
import {
  applySubscriptionSnapshot,
  invoiceWriteFromPaid,
} from "./stripe-apply";

export async function handleStripeEvent(
  event: Stripe.Event,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscription(event.data.object as Stripe.Subscription);
    case "invoice.paid":
      return handleInvoicePaid(event.data.object as Stripe.Invoice);
    case "invoice.updated":
      return handleInvoiceUpdated(event.data.object as Stripe.Invoice);
    case "charge.refunded":
      return handleChargeRefunded(event.data.object as Stripe.Charge);
    default:
      return { ok: true };
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId =
    text(session.metadata?.userId) ?? text(session.client_reference_id);
  const customerId = idOf(session.customer);
  if (!userId || !customerId) {
    return { ok: true };
  }
  const subscriptionId = idOf(session.subscription);
  await saveStripeCustomerIds({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });
  if (!subscriptionId) {
    return { ok: true };
  }
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Stripe is not configured." };
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return handleSubscription(subscription, userId);
}

async function handleSubscription(
  subscription: Stripe.Subscription,
  knownUserId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const customerId = idOf(subscription.customer);
  if (!customerId) {
    return { ok: false, error: "Subscription is missing a customer." };
  }
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const planFromPrice = priceId
    ? await getMembershipPlanByStripePriceId(priceId)
    : null;
  const applied = applySubscriptionSnapshot({
    customerId,
    subscriptionId: subscription.id,
    stripeStatus: subscription.status,
    priceId,
    planIdFromPrice: planFromPrice?.id ?? null,
    planIdFromMetadata: text(subscription.metadata?.planId),
    periodEnd: subscriptionPeriodEnd(subscription),
  });
  if ("ok" in applied) {
    return applied;
  }
  const userId =
    knownUserId ??
    text(subscription.metadata?.userId) ??
    (await getMemberBillingByCustomer(customerId))?.userId;
  if (!userId) {
    return { ok: true };
  }
  const saved = await applyMemberSubscription(userId, applied);
  if (!saved.ok) {
    return saved;
  }
  await writeEventLog({
    scope: "system",
    event: "membership.stripe_subscription",
    message: "Applied Stripe subscription",
    userId,
    data: {
      status: applied.subscriptionStatus,
      planId: applied.planId,
      subscriptionId: subscription.id,
    },
  });
  return { ok: true };
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const customerId = idOf(invoice.customer);
  if (!customerId || !invoice.id) {
    return { ok: true };
  }
  const member =
    (await getMemberBillingByCustomer(customerId)) ??
    (await memberFromInvoice(invoice));
  if (!member) {
    return { ok: true };
  }
  const priceId = invoicePriceId(invoice);
  const planFromPrice = priceId
    ? await getMembershipPlanByStripePriceId(priceId)
    : null;
  const planId = planFromPrice?.id ?? member.planId;
  const write = invoiceWriteFromPaid({
    invoiceId: invoice.id,
    amountPaidCents: invoice.amount_paid ?? 0,
    periodStart: invoicePeriod(invoice, "start"),
    periodEnd: invoicePeriod(invoice, "end"),
  });
  const recorded = await recordStripeInvoice(member.userId, planId, write);
  if (!recorded.ok) {
    return recorded;
  }
  if (recorded.inserted) {
    await writeEventLog({
      scope: "system",
      event: "membership.invoice_paid",
      message: "Recorded Stripe invoice",
      userId: member.userId,
      data: { invoiceId: invoice.id, amountUsd: write.amountUsd, planId },
    });
  }
  return { ok: true };
}

async function handleInvoiceUpdated(
  invoice: Stripe.Invoice,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!invoice.id) {
    return { ok: true };
  }
  if (invoice.status === "void") {
    return markStripeInvoiceRefunded(invoice.id);
  }
  const refundedCents = (invoice as { amount_refunded?: number }).amount_refunded;
  const refunded = typeof refundedCents === "number" && refundedCents > 0;
  if (refunded) {
    return markStripeInvoiceRefunded(invoice.id);
  }
  return { ok: true };
}

async function handleChargeRefunded(
  charge: Stripe.Charge,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const invoiceId = idOf((charge as { invoice?: unknown }).invoice);
  if (!invoiceId) {
    return { ok: true };
  }
  return markStripeInvoiceRefunded(invoiceId);
}

async function memberFromInvoice(invoice: Stripe.Invoice) {
  const raw = invoice as {
    parent?: { subscription_details?: { metadata?: { userId?: string } } };
    subscription_details?: { metadata?: { userId?: string } };
  };
  const metadataUser =
    text(raw.parent?.subscription_details?.metadata?.userId) ??
    text(raw.subscription_details?.metadata?.userId);
  if (metadataUser) {
    return getMemberBilling(metadataUser);
  }
  return null;
}

function invoicePriceId(invoice: Stripe.Invoice): string | null {
  const line = invoice.lines?.data[0] as
    | {
        pricing?: { price_details?: { price?: string } };
        price?: { id?: string };
        period?: { start?: number; end?: number };
      }
    | undefined;
  if (!line) {
    return null;
  }
  const priced = line.pricing?.price_details?.price;
  if (typeof priced === "string") {
    return priced;
  }
  return line.price?.id ?? null;
}

function invoicePeriod(
  invoice: Stripe.Invoice,
  side: "start" | "end",
): number | null {
  const line = invoice.lines?.data[0] as
    | { period?: { start?: number; end?: number } }
    | undefined;
  const fromLine = side === "start" ? line?.period?.start : line?.period?.end;
  if (typeof fromLine === "number") {
    return fromLine;
  }
  const legacy = invoice as {
    period_start?: number;
    period_end?: number;
  };
  const fromInvoice = side === "start" ? legacy.period_start : legacy.period_end;
  return typeof fromInvoice === "number" ? fromInvoice : null;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  const direct = (subscription as { current_period_end?: number })
    .current_period_end;
  if (typeof direct === "number") {
    return direct;
  }
  const item = subscription.items.data[0] as
    | { current_period_end?: number }
    | undefined;
  return typeof item?.current_period_end === "number"
    ? item.current_period_end
    : null;
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value) {
    return value;
  }
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
