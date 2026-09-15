import {
  planIsArchived,
  planIsDraft,
  type MembershipPlan,
} from "./catalog";
import {
  WALLET_PERIOD_MS,
  roundUsd,
  walletEntryDelta as walletBookDelta,
} from "./wallet";

export const BILLING_PATH = "/account/billing";
export const CHECKOUT_PATH = "/account/billing/checkout";
export const BILLING_METHODS = ["stripe", "wallet"] as const;
export type BillingMethod = (typeof BILLING_METHODS)[number];

export const BILLING_METHOD_LABELS: Record<BillingMethod, string> = {
  stripe: "Credit Card (Stripe)",
  wallet: "Crypto",
};

export const CRYPTO_CREDIT_DEDUCT_LABEL =
  "Deduct payment from Affiliate earnings if required";

export const CRYPTO_CREDIT_DEDUCT_NOTE =
  "If your Account balance doesn't have sufficient funds to pay your subscription, the shortfall will be transferred from your Affiliate earnings to your Account balance.";

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

export function invoiceMethodLabel(method: InvoiceMethod): string {
  if (method === "stripe") {
    return "Card";
  }
  if (method === "wallet") {
    return "Crypto";
  }
  return "Comp";
}

export const BILLING_TABLE_PAGE_SIZE = 20;

export function parseBillingPage(value: unknown): number {
  const page = Math.trunc(Number(String(value ?? "").trim()));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function paginateBillingRows<T>(
  rows: readonly T[],
  page: number,
  pageSize = BILLING_TABLE_PAGE_SIZE,
): {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
} {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);
  return {
    rows: slice,
    page: safePage,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

export function billingPageLabel(input: {
  total: number;
  from: number;
  to: number;
}): string {
  if (input.total === 0) {
    return "No rows.";
  }
  return `Showing ${input.from}–${input.to} of ${input.total}`;
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

export function embeddedCardReturnUrl(origin: string): string {
  const base = origin.trim().replace(/\/$/, "");
  return `${base}/account/billing?tab=method&saved=card&session_id={CHECKOUT_SESSION_ID}`;
}

export function embeddedSwitchToCardReturnUrl(origin: string): string {
  const base = origin.trim().replace(/\/$/, "");
  return `${base}/account/billing?tab=method&saved=method&session_id={CHECKOUT_SESSION_ID}`;
}

/** Stripe trial_end unix seconds, or null when the cycle is too close to charge now. */
export function switchToCardTrialEnd(
  periodEnd: string | null,
  nowMs = Date.now(),
): number | null {
  if (!periodEnd) {
    return null;
  }
  const endMs = Date.parse(periodEnd);
  if (!Number.isFinite(endMs)) {
    return null;
  }
  const minMs = nowMs + 48 * 60 * 60 * 1000;
  if (endMs < minMs) {
    return null;
  }
  return Math.floor(endMs / 1000);
}

export function stripeCheckoutBranding() {
  return {
    background_color: "#161b22",
    button_color: "#8b6cf6",
    border_style: "rounded" as const,
    display_name: "TBP",
  };
}

export type CheckoutCharge =
  | { kind: "initial"; dueUsd: number }
  | {
      kind: "upgrade";
      dueUsd: number;
      periodEnd: string;
      basis: "prorate" | "delta";
    };

export function isPaidCycleUpgrade(input: {
  currentPriceUsd: number;
  targetPriceUsd: number;
  periodEnd?: string | null;
  nowMs?: number;
}): boolean {
  return (
    roundUsd(input.currentPriceUsd) >= 0.01 &&
    roundUsd(input.targetPriceUsd) > roundUsd(input.currentPriceUsd)
  );
}

export function prorateUpgradeUsd(input: {
  oldPriceUsd: number;
  newPriceUsd: number;
  periodEnd: string;
  nowMs?: number;
  periodMs?: number;
}): number {
  const now = input.nowMs ?? Date.now();
  const end = Date.parse(input.periodEnd);
  if (!Number.isFinite(end) || end <= now) {
    return 0;
  }
  const periodMs = input.periodMs ?? WALLET_PERIOD_MS;
  const remaining = Math.min(periodMs, end - now);
  const delta = roundUsd(input.newPriceUsd) - roundUsd(input.oldPriceUsd);
  if (delta <= 0 || periodMs <= 0) {
    return 0;
  }
  return roundUsd((delta * remaining) / periodMs);
}

export function showCheckoutMethodPicker(input: {
  chargeKind: "initial" | "upgrade";
  billingMethod: BillingMethod | null;
  subscriptionStatus: SubscriptionStatus;
}): boolean {
  if (input.chargeKind !== "initial") {
    return false;
  }
  return (
    input.billingMethod === null || input.subscriptionStatus === "none"
  );
}

export function checkoutCharge(input: {
  currentPriceUsd: number;
  targetPriceUsd: number;
  periodEnd: string | null;
  nowMs?: number;
}): CheckoutCharge {
  if (!isPaidCycleUpgrade(input)) {
    return { kind: "initial", dueUsd: roundUsd(input.targetPriceUsd) };
  }
  const now = input.nowMs ?? Date.now();
  const end = input.periodEnd ? Date.parse(input.periodEnd) : NaN;
  if (input.periodEnd && Number.isFinite(end) && end > now) {
    return {
      kind: "upgrade",
      dueUsd: prorateUpgradeUsd({
        oldPriceUsd: input.currentPriceUsd,
        newPriceUsd: input.targetPriceUsd,
        periodEnd: input.periodEnd,
        nowMs: now,
      }),
      periodEnd: input.periodEnd,
      basis: "prorate",
    };
  }
  return {
    kind: "upgrade",
    dueUsd: roundUsd(input.targetPriceUsd - input.currentPriceUsd),
    periodEnd: new Date(now + WALLET_PERIOD_MS).toISOString(),
    basis: "delta",
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
  return walletBookDelta(kind, amountUsd);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatUsd(amount: number): string {
  const integer = Number.isInteger(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: integer ? 0 : 2,
    maximumFractionDigits: integer ? 0 : 2,
  }).format(amount);
}

export type BillingCycleWindow = {
  startMs: number;
  endMs: number;
  remainingMs: number;
};

export function resolveBillingCycle(input: {
  periodEnd: string | null;
  periodStart?: string | null;
  nowMs?: number;
  periodMs?: number;
}): BillingCycleWindow | null {
  const endMs = input.periodEnd ? Date.parse(input.periodEnd) : NaN;
  if (!Number.isFinite(endMs) || endMs <= 0) {
    return null;
  }
  const startParsed = input.periodStart ? Date.parse(input.periodStart) : NaN;
  const startMs = Number.isFinite(startParsed)
    ? startParsed
    : endMs - (input.periodMs ?? WALLET_PERIOD_MS);
  const now = input.nowMs ?? Date.now();
  return {
    startMs,
    endMs,
    remainingMs: endMs - now,
  };
}

export function formatRemainingCycle(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "Ended";
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const days = Math.floor(remainingMs / dayMs);
  const hours = Math.floor((remainingMs % dayMs) / hourMs);
  if (days >= 2) {
    return `${days} days left`;
  }
  if (days === 1) {
    return hours > 0 ? `1 day ${hours}h left` : "1 day left";
  }
  if (hours >= 1) {
    return `${hours}h left`;
  }
  const minutes = Math.max(1, Math.floor(remainingMs / 60_000));
  return `${minutes} min left`;
}
