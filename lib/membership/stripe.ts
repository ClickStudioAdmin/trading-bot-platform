import { headers } from "next/headers";
import Stripe from "stripe";
import { appOriginFromEnv } from "./billing";

let cached: Stripe | null | undefined;

export function stripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe | null {
  if (cached !== undefined) {
    return cached;
  }
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  cached = key ? new Stripe(key) : null;
  return cached;
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
