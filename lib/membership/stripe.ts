import { headers } from "next/headers";
import Stripe from "stripe";
import { appOriginFromEnv, type StripeCardOnFile } from "./billing";

let cached: Stripe | null | undefined;

export function stripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function stripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
}

export function stripePublishableConfigured(): boolean {
  return Boolean(stripePublishableKey());
}

export function getStripe(): Stripe | null {
  if (cached !== undefined) {
    return cached;
  }
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  cached = key ? new Stripe(key) : null;
  return cached;
}

function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string" && value) {
    return value;
  }
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function cardFromPaymentMethod(
  paymentMethod: Stripe.PaymentMethod | null,
): StripeCardOnFile | null {
  const card = paymentMethod?.card;
  if (!card?.last4) {
    return null;
  }
  return {
    brand: card.brand,
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
  };
}

export async function loadStripeCardOnFile(
  customerId: string | null,
): Promise<StripeCardOnFile | null> {
  if (!customerId) {
    return null;
  }
  const stripe = getStripe();
  if (!stripe) {
    return null;
  }
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return null;
    }
    const defaultId = stripeObjectId(
      customer.invoice_settings?.default_payment_method,
    );
    if (defaultId) {
      const paymentMethod = await stripe.paymentMethods.retrieve(defaultId);
      const fromDefault = cardFromPaymentMethod(paymentMethod);
      if (fromDefault) {
        return fromDefault;
      }
    }
    const cards = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    return cardFromPaymentMethod(cards.data[0] ?? null);
  } catch {
    return null;
  }
}

export async function stripeCustomerHasCard(
  customerId: string | null,
): Promise<boolean> {
  return (await loadStripeCardOnFile(customerId)) !== null;
}

export function stripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

export async function billingOrigin(): Promise<string> {
  const fromEnv = appOriginFromEnv();
  if (fromEnv) {
    return fromEnv;
  }
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) {
    return "";
  }
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export function constructStripeEvent(
  rawBody: string,
  signature: string | null,
): Stripe.Event {
  const stripe = getStripe();
  const secret = stripeWebhookSecret();
  if (!stripe || !secret) {
    throw new Error("Stripe webhook is not configured.");
  }
  if (!signature) {
    throw new Error("Missing Stripe signature.");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
