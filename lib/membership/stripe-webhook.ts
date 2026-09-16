import { writeEventLog } from "@/lib/logs/write";
import type Stripe from "stripe";
import {
  applyMemberSubscription,
  clearStripeSubscriptionId,
  getMemberBilling,
  getMemberBillingByCustomer,
  markStripeInvoiceRefunded,
  recordStripeInvoice,
  saveBillingMethod,
  saveStripeCustomerIds,
} from "./billing-store";
import {
  markOpenStripeInvoicePaid,
  voidOpenInvoices,
} from "./billing-cycle-store";
import { stripeCentsToUsd, switchToCardTrialEnd } from "./billing";
import { getMembershipPlan, getMembershipPlanByStripePriceId } from "./store";
import { getStripe, isStripeMissingResource } from "./stripe";
import {
  applySubscriptionSnapshot,
  invoiceWriteFromPaid,
  isLiveStripeSubscriptionStatus,
  stripeCollectionSyncAction,
  stripeInvoicePaidApplies,
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
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
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
    if (text(session.metadata?.purpose) === "switch_to_card") {
      return handleSwitchToCardSetup(session, userId, customerId);
    }
    return { ok: true };
  }
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Stripe is not configured." };
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return handleSubscription(subscription, userId);
}

async function handleSwitchToCardSetup(
  session: Stripe.Checkout.Session,
  userId: string,
  customerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const saved = await saveBillingMethod(userId, "stripe");
  if (!saved.ok) {
    return saved;
  }
  const billing = await getMemberBilling(userId);
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Stripe is not configured." };
  }
  const paymentMethod = await setupPaymentMethodId(stripe, session);
  if (paymentMethod) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethod },
      });
    } catch {
      // Card is still on the customer from Checkout setup.
    }
  }
  const started = await startCardSwitchSubscription({
    stripe,
    userId,
    customerId,
    billing,
    paymentMethod,
  });
  if (!started.ok) {
    return started;
  }
  await writeEventLog({
    scope: "system",
    event: "membership.billing_method",
    message: "Switched collection method to Card",
    userId,
    data: { method: "stripe", purpose: "switch_to_card" },
  });
  return { ok: true };
}

export async function syncStripeForCollectionMethod(input: {
  userId: string;
  method: "stripe" | "wallet";
  subscriptionId: string | null;
}): Promise<{ ok: true; live: boolean } | { ok: false; error: string }> {
  const stripe = getStripe();
  if (!stripe || !input.subscriptionId) {
    return { ok: true, live: false };
  }
  let stripeStatus: string | null;
  try {
    const current = await stripe.subscriptions.retrieve(input.subscriptionId);
    stripeStatus = current.status;
  } catch (cause) {
    if (isStripeMissingResource(cause)) {
      const cleared = await clearStripeSubscriptionId(input.userId);
      if (!cleared.ok) {
        return cleared;
      }
      return { ok: true, live: false };
    }
    return {
      ok: false,
      error:
        cause instanceof Error ? cause.message : "Stripe subscription lookup failed.",
    };
  }
  const action = stripeCollectionSyncAction({
    method: input.method,
    stripeStatus,
  });
  try {
    if (action === "cancel_at_period_end") {
      await stripe.subscriptions.update(input.subscriptionId, {
        cancel_at_period_end: true,
      });
      return { ok: true, live: true };
    }
    if (action === "resume") {
      await stripe.subscriptions.update(input.subscriptionId, {
        cancel_at_period_end: false,
      });
      return { ok: true, live: true };
    }
    if (action === "recreate") {
      const cleared = await clearStripeSubscriptionId(input.userId);
      if (!cleared.ok) {
        return cleared;
      }
    }
    return { ok: true, live: false };
  } catch (cause) {
    if (isStripeMissingResource(cause) || action === "recreate") {
      const cleared = await clearStripeSubscriptionId(input.userId);
      if (!cleared.ok) {
        return cleared;
      }
      return { ok: true, live: false };
    }
    return {
      ok: false,
      error:
        cause instanceof Error ? cause.message : "Stripe subscription update failed.",
    };
  }
}

async function liveStripeSubscriptionId(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  subscriptionId: string | null,
): Promise<string | null> {
  if (!subscriptionId) {
    return null;
  }
  try {
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    return isLiveStripeSubscriptionStatus(current.status) ? current.id : null;
  } catch (cause) {
    if (isStripeMissingResource(cause)) {
      return null;
    }
    throw cause;
  }
}

export async function ensureCardSwitchSubscription(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const billing = await getMemberBilling(userId);
  const stripe = getStripe();
  if (!stripe || !billing?.stripeCustomerId) {
    return { ok: true };
  }
  try {
    const liveId = await liveStripeSubscriptionId(
      stripe,
      billing.stripeSubscriptionId,
    );
    if (liveId) {
      await stripe.subscriptions.update(liveId, {
        cancel_at_period_end: false,
      });
      return { ok: true };
    }
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error ? cause.message : "Stripe subscription update failed.",
    };
  }
  let paymentMethod: string | null = null;
  try {
    const customer = await stripe.customers.retrieve(billing.stripeCustomerId);
    if (!customer.deleted) {
      paymentMethod = idOf(customer.invoice_settings?.default_payment_method);
    }
    if (!paymentMethod) {
      const cards = await stripe.paymentMethods.list({
        customer: billing.stripeCustomerId,
        type: "card",
        limit: 1,
      });
      paymentMethod = cards.data[0]?.id ?? null;
    }
  } catch {
    return { ok: true };
  }
  if (!paymentMethod) {
    return { ok: true };
  }
  return startCardSwitchSubscription({
    stripe,
    userId,
    customerId: billing.stripeCustomerId,
    billing: {
      ...billing,
      stripeSubscriptionId: null,
    },
    paymentMethod,
  });
}

async function startCardSwitchSubscription(input: {
  stripe: NonNullable<ReturnType<typeof getStripe>>;
  userId: string;
  customerId: string;
  billing: Awaited<ReturnType<typeof getMemberBilling>>;
  paymentMethod: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { stripe, userId, customerId, billing, paymentMethod } = input;
  if (!billing) {
    return { ok: true };
  }
  const loaded = await getMembershipPlan(billing.planId);
  if (!loaded.ok) {
    return loaded;
  }
  if (loaded.plan.priceUsd < 0.01) {
    return { ok: true };
  }
  const item = await cardSwitchSubscriptionItem(stripe, loaded.plan);
  const firstCharge = switchToCardTrialEnd(billing.periodEnd);
  try {
    const liveId = await liveStripeSubscriptionId(
      stripe,
      billing.stripeSubscriptionId,
    );
    if (liveId) {
      const current = await stripe.subscriptions.retrieve(liveId);
      const existingItemId = current.items.data[0]?.id;
      await stripe.subscriptions.update(liveId, {
        cancel_at_period_end: false,
        proration_behavior: "none",
        items: existingItemId ? [{ id: existingItemId, ...item }] : [item],
        ...(paymentMethod ? { default_payment_method: paymentMethod } : {}),
      });
      return { ok: true };
    }
    if (billing.stripeSubscriptionId) {
      const cleared = await clearStripeSubscriptionId(userId);
      if (!cleared.ok) {
        return cleared;
      }
    }
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [item],
      ...(paymentMethod ? { default_payment_method: paymentMethod } : {}),
      ...(firstCharge
        ? {
            billing_cycle_anchor: firstCharge,
            proration_behavior: "none",
          }
        : {}),
      metadata: {
        userId,
        planId: billing.planId,
        purpose: "switch_to_card",
      },
    });
    return saveStripeCustomerIds({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
    });
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error
          ? cause.message
          : "Stripe subscription update failed.",
    };
  }
}

async function cardSwitchSubscriptionItem(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  plan: { id: string; name: string; priceUsd: number; stripePriceId: string | null },
): Promise<Stripe.SubscriptionCreateParams.Item> {
  const cents = Math.round(plan.priceUsd * 100);
  let productId: string | null = null;
  if (plan.stripePriceId) {
    try {
      const price = await stripe.prices.retrieve(plan.stripePriceId);
      if (price.unit_amount === cents && price.currency === "usd") {
        return { price: plan.stripePriceId };
      }
      productId = idOf(price.product);
    } catch {
      // Catalog price id is missing or does not match the TBP plan amount.
    }
  }
  if (!productId) {
    const product = await stripe.products.create({
      name: plan.name,
      metadata: { planId: plan.id, purpose: "switch_to_card" },
    });
    productId = product.id;
  }
  return {
    price_data: {
      currency: "usd",
      product: productId,
      unit_amount: cents,
      recurring: { interval: "month" },
    },
  };
}

async function setupPaymentMethodId(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const fromSession = idOf(session.setup_intent);
  if (!fromSession) {
    return null;
  }
  const setupIntent = await stripe.setupIntents.retrieve(fromSession);
  return idOf(setupIntent.payment_method);
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
  const message =
    saved.effect === "wallet_ignored"
      ? "Ignored Stripe subscription while Crypto is the collection method"
      : saved.effect === "wallet_cleared"
        ? "Cleared ended Stripe subscription; Crypto collection unchanged"
        : "Applied Stripe subscription";
  await writeEventLog({
    scope: "system",
    event: "membership.stripe_subscription",
    message,
    userId,
    data: {
      status: applied.subscriptionStatus,
      planId: applied.planId,
      subscriptionId: subscription.id,
      effect: saved.effect,
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
  if (!stripeInvoicePaidApplies(member.billingMethod)) {
    const voided = await voidOpenInvoices(member.userId, "stripe");
    if (!voided.ok) {
      return voided;
    }
    await writeEventLog({
      scope: "system",
      event: "membership.invoice_paid",
      message: "Ignored Stripe invoice.paid; Crypto collection is saved",
      userId: member.userId,
      data: { invoiceId: invoice.id, voided: voided.voided },
    });
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
  const matched = await markOpenStripeInvoicePaid({
    userId: member.userId,
    stripeInvoiceId: invoice.id,
    amountUsd: write.amountUsd,
    periodStartMs: write.periodStart ? Date.parse(write.periodStart) : null,
    periodEnd: write.periodEnd,
    planId,
  });
  if ("ok" in matched && matched.ok === false) {
    return matched;
  }
  if ("matched" in matched && matched.matched) {
    await writeEventLog({
      scope: "system",
      event: "membership.invoice_paid",
      message: "Marked open Stripe invoice paid",
      userId: member.userId,
      data: { invoiceId: invoice.id, amountUsd: write.amountUsd, planId },
    });
    const { notifyInvoicePaid } = await import(
      "@/lib/notifications/commercial"
    );
    await notifyInvoicePaid({
      userId: member.userId,
      invoiceId: invoice.id,
      planId,
      amountUsd: write.amountUsd,
      periodEnd: write.periodEnd,
    });
    return { ok: true };
  }
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
    const { notifyInvoicePaid } = await import(
      "@/lib/notifications/commercial"
    );
    await notifyInvoicePaid({
      userId: member.userId,
      invoiceId: invoice.id,
      planId,
      amountUsd: write.amountUsd,
      periodEnd: write.periodEnd,
    });
  }
  return { ok: true };
}

async function handleInvoicePaymentFailed(
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
  if (!stripeInvoicePaidApplies(member.billingMethod)) {
    return { ok: true };
  }
  const amountUsd = stripeCentsToUsd(invoice.amount_due ?? 0);
  const raw = invoice as {
    last_finalization_error?: { message?: string | null };
  };
  const reason =
    text(raw.last_finalization_error?.message) ??
    "Card collect did not succeed.";
  const { notifyPaymentFailed } = await import(
    "@/lib/notifications/commercial"
  );
  await notifyPaymentFailed({
    userId: member.userId,
    invoiceOrIntentId: invoice.id,
    amountUsd,
    reason,
  });
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
