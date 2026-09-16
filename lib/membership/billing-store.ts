import { createServiceClient } from "@/lib/supabase/admin";
import {
  parseBillingMethod,
  parseInvoiceMethod,
  parseInvoiceStatus,
  parseSubscriptionStatus,
  type MemberBilling,
  type MembershipInvoice,
} from "./billing";

export type AdminInvoice = MembershipInvoice & {
  userId: string;
  email: string | null;
};
import {
  createCommissionsForInvoice,
  reverseCommissionsForInvoice,
} from "./affiliate-store";
import {
  getDefaultMembershipPlan,
  getMembershipPlan,
  listMembershipPlans,
} from "./store";
import {
  stripeWebhookAppliesToMember,
  walletStripeWebhookAction,
  type AppliedSubscription,
  type StripeInvoiceWrite,
} from "./stripe-apply";

export { walletBookBalances, walletCreditUsd } from "./wallet-store";

type MemberBillingRow = {
  user_id: string;
  email: string;
  name: string;
  plan_id: string;
  billing_method: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id?: string | null;
  subscription_status: string | null;
  period_end: string | null;
  pay_subscription_from_affiliate?: boolean | null;
  pay_subscription_from_credit?: boolean | null;
};

const BILLING_COLUMNS_CORE =
  "user_id, email, name, plan_id, billing_method, stripe_customer_id, stripe_subscription_id, subscription_status, period_end, pay_subscription_from_affiliate";

const BILLING_COLUMNS = `${BILLING_COLUMNS_CORE}, pay_subscription_from_credit`;

function mapBilling(row: MemberBillingRow): MemberBilling {
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    planId: row.plan_id,
    billingMethod: parseBillingMethod(row.billing_method),
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id ?? null,
    subscriptionStatus: parseSubscriptionStatus(row.subscription_status),
    periodEnd: row.period_end,
    paySubscriptionFromAffiliate: row.pay_subscription_from_affiliate === true,
    paySubscriptionFromCredit: row.pay_subscription_from_credit === true,
  };
}

async function loadMemberBilling(
  column: "user_id" | "stripe_customer_id",
  value: string,
): Promise<MemberBilling | null> {
  const supabase = createServiceClient();
  if (!supabase || !value) {
    return null;
  }
  const full = await supabase
    .from("members")
    .select(BILLING_COLUMNS)
    .eq(column, value)
    .maybeSingle();
  if (full.data) {
    return mapBilling(full.data as MemberBillingRow);
  }
  const core = await supabase
    .from("members")
    .select(BILLING_COLUMNS_CORE)
    .eq(column, value)
    .maybeSingle();
  return core.data ? mapBilling(core.data as MemberBillingRow) : null;
}

export async function getMemberBilling(
  userId: string,
): Promise<MemberBilling | null> {
  return loadMemberBilling("user_id", userId);
}

export async function getMemberBillingByCustomer(
  customerId: string,
): Promise<MemberBilling | null> {
  return loadMemberBilling("stripe_customer_id", customerId);
}

export async function saveBillingMethod(
  userId: string,
  method: "stripe" | "wallet",
  extras: { paySubscriptionFromCredit?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const update: Record<string, unknown> = {
    billing_method: method,
    updated_at: new Date().toISOString(),
  };
  if (method === "wallet") {
    const deduct = extras.paySubscriptionFromCredit === true;
    update.pay_subscription_from_credit = deduct;
    update.pay_subscription_from_affiliate = deduct;
  }
  let { error } = await supabase
    .from("members")
    .update(update)
    .eq("user_id", userId);
  if (error && "pay_subscription_from_credit" in update) {
    delete update.pay_subscription_from_credit;
    const retry = await supabase
      .from("members")
      .update(update)
      .eq("user_id", userId);
    error = retry.error;
  }
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function saveStripeCustomerIds(input: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const update: Record<string, unknown> = {
    stripe_customer_id: input.stripeCustomerId,
    billing_method: "stripe",
    updated_at: new Date().toISOString(),
  };
  if (input.stripeSubscriptionId) {
    update.stripe_subscription_id = input.stripeSubscriptionId;
  }
  const { error } = await supabase
    .from("members")
    .update(update)
    .eq("user_id", input.userId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function applyMemberPlanNow(input: {
  userId: string;
  planId: string;
  periodEnd: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const plan = await getMembershipPlan(input.planId);
  if (!plan.ok) {
    return { ok: false, error: plan.error };
  }
  const { error } = await supabase
    .from("members")
    .update({
      plan_id: input.planId,
      last_enroll_plan_id: input.planId,
      subscription_status: "active",
      period_end: input.periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function clearStripeSubscriptionId(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("members")
    .update({
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function applyMemberSubscription(
  userId: string,
  applied: AppliedSubscription,
): Promise<
  | { ok: true; effect: "applied" | "wallet_ignored" | "wallet_cleared" }
  | { ok: false; error: string }
> {
  const existing = await getMemberBilling(userId);
  if (
    !stripeWebhookAppliesToMember({
      billingMethod: existing?.billingMethod ?? null,
      applied,
    })
  ) {
    if (walletStripeWebhookAction(applied) === "clear_subscription") {
      const cleared = await clearStripeSubscriptionId(userId);
      if (!cleared.ok) {
        return cleared;
      }
      return { ok: true, effect: "wallet_cleared" };
    }
    return { ok: true, effect: "wallet_ignored" };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  let planId = applied.planId;
  if (applied.revertToDefault) {
    const fallback = await getDefaultMembershipPlan();
    planId = fallback?.id ?? planId;
  }
  if (!planId) {
    return { ok: false, error: "Could not resolve a plan from Stripe." };
  }
  const plan = await getMembershipPlan(planId);
  const update: Record<string, unknown> = {
    plan_id: planId,
    stripe_customer_id: applied.stripeCustomerId,
    stripe_subscription_id: applied.stripeSubscriptionId,
    subscription_status: applied.subscriptionStatus,
    period_end: applied.periodEnd,
    billing_method: "stripe",
    updated_at: new Date().toISOString(),
  };
  if (plan.ok) {
    update.last_enroll_plan_id = planId;
  }
  const { error } = await supabase
    .from("members")
    .update(update)
    .eq("user_id", userId);
  if (error) {
    return { ok: false, error: error.message };
  }
  if (applied.subscriptionStatus === "past_due") {
    const { notifySubscriptionPastDue } = await import(
      "@/lib/notifications/commercial"
    );
    await notifySubscriptionPastDue({
      userId,
      periodEnd: applied.periodEnd,
    });
  }
  return { ok: true, effect: "applied" };
}

export async function recordStripeInvoice(
  userId: string,
  planId: string,
  write: StripeInvoiceWrite,
): Promise<{ ok: true; inserted: boolean } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data: existing } = await supabase
    .from("membership_invoices")
    .select("id, status")
    .eq("method", "stripe")
    .eq("external_id", write.externalId)
    .maybeSingle();
  if (existing) {
    return { ok: true, inserted: false };
  }
  const { data, error } = await supabase
    .from("membership_invoices")
    .insert({
      user_id: userId,
      plan_id: planId,
      method: write.method,
      external_id: write.externalId,
      amount_usd: write.amountUsd,
      status: write.status,
      period_start: write.periodStart,
      period_end: write.periodEnd,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return { ok: true, inserted: false };
    }
    return { ok: false, error: error.message };
  }
  if (write.status === "paid" && data?.id) {
    const commissions = await createCommissionsForInvoice({
      invoiceId: String(data.id),
      sourceUserId: userId,
      method: write.method,
      status: write.status,
      amountUsd: write.amountUsd,
    });
    if (!commissions.ok) {
      return commissions;
    }
  }
  return { ok: true, inserted: true };
}

export async function markStripeInvoiceRefunded(
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data } = await supabase
    .from("membership_invoices")
    .select("id")
    .eq("method", "stripe")
    .eq("external_id", invoiceId)
    .maybeSingle();
  const { error } = await supabase
    .from("membership_invoices")
    .update({ status: "refunded" })
    .eq("method", "stripe")
    .eq("external_id", invoiceId);
  if (error) {
    return { ok: false, error: error.message };
  }
  if (data?.id) {
    return reverseCommissionsForInvoice(String(data.id));
  }
  return { ok: true };
}

function mapInvoice(
  row: Record<string, unknown>,
  names: Map<string, string>,
): MembershipInvoice | null {
  const method = parseInvoiceMethod(row.method);
  const status = parseInvoiceStatus(row.status);
  if (!method || !status) {
    return null;
  }
  const planId = String(row.plan_id);
  return {
    id: String(row.id),
    planId,
    planName: names.get(planId) ?? "Plan",
    method,
    externalId: typeof row.external_id === "string" ? row.external_id : null,
    amountUsd: Number(row.amount_usd),
    status,
    periodStart:
      typeof row.period_start === "string" ? row.period_start : null,
    periodEnd: typeof row.period_end === "string" ? row.period_end : null,
    dueAt: typeof row.due_at === "string" ? row.due_at : null,
    createdAt: String(row.created_at),
  };
}

async function planNames(): Promise<Map<string, string>> {
  const listed = await listMembershipPlans();
  return new Map(
    (listed.ok ? listed.plans : []).map((plan) => [plan.id, plan.name]),
  );
}

export async function listMemberInvoices(
  userId: string,
): Promise<MembershipInvoice[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data } = await supabase
    .from("membership_invoices")
    .select(
      "id, plan_id, method, external_id, amount_usd, status, period_start, period_end, due_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  const names = await planNames();
  return (data ?? [])
    .map((row) => mapInvoice(row as Record<string, unknown>, names))
    .filter((row): row is MembershipInvoice => row !== null);
}

export async function listAdminInvoices(
  limit = 200,
): Promise<AdminInvoice[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data } = await supabase
    .from("membership_invoices")
    .select(
      "id, user_id, plan_id, method, external_id, amount_usd, status, period_start, period_end, due_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  const names = await planNames();
  const invoices = (data ?? []).flatMap((row) => {
    const mapped = mapInvoice(row as Record<string, unknown>, names);
    if (!mapped) {
      return [];
    }
    return [
      {
        ...mapped,
        userId: String(row.user_id),
        email: null as string | null,
      },
    ];
  });
  const userIds = [...new Set(invoices.map((row) => row.userId))];
  if (userIds.length === 0) {
    return invoices;
  }
  const { data: members } = await supabase
    .from("members")
    .select("user_id, email")
    .in("user_id", userIds);
  const emails = new Map(
    (members ?? []).map((member) => [
      String(member.user_id),
      String(member.email),
    ]),
  );
  return invoices.map((row) => ({
    ...row,
    email: emails.get(row.userId) ?? null,
  }));
}
