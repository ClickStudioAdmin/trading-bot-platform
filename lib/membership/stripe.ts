import { headers } from "next/headers";
import Stripe from "stripe";
import { appOriginFromEnv } from "./billing";

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

export async function stripeCustomerHasCard(
  customerId: string | null,
): Promise<boolean> {
  if (!customerId) {
    return false;
  }
  const stripe = getStripe();
  if (!stripe) {
    return false;
  }
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return false;
    }
    if (stripeObjectId(customer.invoice_settings?.default_payment_method)) {
      return true;
    }
    const cards = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    return cards.data.length > 0;
  } catch {
    return false;
  }
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
