import {
  planIsArchived,
  planIsDraft,
  type MembershipPlan,
} from "./catalog";

export const BILLING_PATH = "/account/billing";
export const CHECKOUT_PATH = "/account/billing/checkout";
export const BILLING_METHODS = ["stripe", "wallet"] as const;
export type BillingMethod = (typeof BILLING_METHODS)[number];

export const BILLING_METHOD_LABELS: Record<BillingMethod, string> = {
  stripe: "Card",
  wallet: "Crypto",
};

export const CRYPTO_CREDIT_DEDUCT_LABEL =
  "Deduct payments from Crypto Credit where possible";

export const SUBSCRIPTION_STATUSES = [
  "none",
  "active",
  "past_due",
  "canceled",
  "comp",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  none: "None",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  comp: "Comp",
};

export const INVOICE_METHODS = ["stripe", "wallet", "comp"] as const;
export type InvoiceMethod = (typeof INVOICE_METHODS)[number];

export const INVOICE_STATUSES = ["paid", "refunded", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type MemberBilling = {
  userId: string;
  email: string;
  name: string;
  planId: string;
  billingMethod: BillingMethod | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus;
  periodEnd: string | null;
  paySubscriptionFromAffiliate: boolean;
  paySubscriptionFromCredit: boolean;
};

export type MembershipInvoice = {
  id: string;
  planId: string;
  planName: string;
  method: InvoiceMethod;
  externalId: string | null;
  amountUsd: number;
  status: InvoiceStatus;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
};

export function parseBillingMethod(value: unknown): BillingMethod | null {
  return BILLING_METHODS.includes(value as BillingMethod)
    ? (value as BillingMethod)
    : null;
}

export function parsePaySubscriptionFromCredit(value: unknown): boolean {
  return String(value ?? "") === "1";
}

export function parseSubscriptionStatus(
  value: unknown,
): SubscriptionStatus {
  return SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus)
    ? (value as SubscriptionStatus)
    : "none";
}

export function parseInvoiceMethod(value: unknown): InvoiceMethod | null {
  return INVOICE_METHODS.includes(value as InvoiceMethod)
    ? (value as InvoiceMethod)
    : null;
}

export function parseInvoiceStatus(value: unknown): InvoiceStatus | null {
  return INVOICE_STATUSES.includes(value as InvoiceStatus)
    ? (value as InvoiceStatus)
    : null;
}

export function billingPath(
  query: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  const encoded = params.toString();
  return encoded ? `${BILLING_PATH}?${encoded}` : BILLING_PATH;
}

export function checkoutPath(
  query: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  const encoded = params.toString();
  return encoded ? `${CHECKOUT_PATH}?${encoded}` : CHECKOUT_PATH;
}

export function appOriginFromEnv(): string {
  return process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ?? "";
}

export function stripeCentsToUsd(cents: number): number {
  if (!Number.isFinite(cents)) {
    return 0;
  }
  return Math.round(cents) / 100;
}

export function mapStripeSubscriptionStatus(
  status: string,
): Exclude<SubscriptionStatus, "comp" | "none"> | null {
  if (status === "active" || status === "trialing") {
    return "active";
  }
  if (
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete"
  ) {
    return "past_due";
  }
  if (status === "canceled" || status === "incomplete_expired") {
    return "canceled";
  }
  return null;
}

export type UpgradeDecision =
  | { kind: "current" }
  | { kind: "need_method" }
  | { kind: "checkout" }
  | { kind: "wallet_shell" }
  | { kind: "reject"; error: string };

export function hasUsableStripeSubscription(billing: {
  stripeSubscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus;
}): boolean {
  return Boolean(
    billing.stripeSubscriptionId &&
      (billing.subscriptionStatus === "active" ||
        billing.subscriptionStatus === "past_due"),
  );
}

export function embeddedCheckoutReturnUrl(origin: string): string {
  const base = origin.trim().replace(/\/$/, "");
  return `${base}/account/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
}

export function stripeCheckoutBranding() {
  return {
    background_color: "#161b22",
    button_color: "#8b6cf6",
    border_style: "rounded" as const,
    display_name: "TBP",
  };
}

export function decideUpgrade(input: {
  currentPlanId: string | null;
  target: Pick<
    MembershipPlan,
    "id" | "priceUsd" | "stripePriceId" | "archivedAt" | "visibility"
  >;
  method: BillingMethod | null;
}): UpgradeDecision {
  if (input.target.id === input.currentPlanId) {
    return { kind: "current" };
  }
  if (planIsArchived(input.target)) {
    return { kind: "reject", error: "That plan is no longer available." };
  }
  if (planIsDraft(input.target)) {
    return { kind: "reject", error: "That plan is not published." };
  }
  if (input.target.priceUsd <= 0) {
    return { kind: "reject", error: "That plan does not require checkout." };
  }
  if (!input.method) {
    return { kind: "need_method" };
  }
  if (input.method === "wallet") {
    return { kind: "wallet_shell" };
  }
  if (!input.target.stripePriceId) {
    return {
      kind: "reject",
      error: "This plan has no Stripe price yet. Add a price id on Admin → Plans.",
    };
  }
  return { kind: "checkout" };
}

export function walletEntryDelta(kind: string, amountUsd: number): number {
  if (!Number.isFinite(amountUsd)) {
    return 0;
  }
  if (kind === "deposit" || kind === "commission") {
    return Math.abs(amountUsd);
  }
  if (kind === "debit_rent" || kind === "withdraw") {
    return -Math.abs(amountUsd);
  }
  return amountUsd;
}

export function formatUsd(amount: number): string {
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `$${rounded}`;
}
