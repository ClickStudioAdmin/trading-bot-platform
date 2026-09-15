import { writeEventLog } from "@/lib/logs/write";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  matchOpenRenewalInvoice,
  openInvoiceIsDue,
  renewalAlreadyCovered,
  renewalCycleFromPeriodEnd,
  renewalExternalId,
  shouldIssueRenewalInvoice,
} from "./billing-cycle";
import { getMemberBilling } from "./billing-store";
import { createCommissionsForInvoice } from "./affiliate-store";
import { getMembershipPlan } from "./store";
import { parseBillingMethod, type BillingMethod } from "./billing";
import { planDeductDecision, roundUsd } from "./wallet";
import { walletBookBalances as loadBooks } from "./wallet-store";
import { sumPayableAffiliateUsd as loadPayable } from "./affiliate-store";

export type OpenInvoiceRow = {
  id: string;
  userId: string;
  planId: string;
  method: BillingMethod;
  amountUsd: number;
  periodStart: string | null;
  periodEnd: string | null;
  dueAt: string | null;
};

export async function runMembershipBillingCycle(input?: {
  nowMs?: number;
  userIds?: string[];
}): Promise<{ issued: number; collected: number; errors: string[] }> {
  const nowMs = input?.nowMs ?? Date.now();
  const result = { issued: 0, collected: 0, errors: [] as string[] };
  const issued = await issueDueRenewalInvoices(nowMs);
  result.issued = issued.issued;
  result.errors.push(...issued.errors);
  const collected = await collectOpenWalletInvoices({
    nowMs,
    userIds: input?.userIds,
  });
  result.collected = collected.collected;
  result.errors.push(...collected.errors);
  return result;
}

export async function issueDueRenewalInvoices(
  nowMs = Date.now(),
): Promise<{ issued: number; errors: string[] }> {
  const supabase = createServiceClient();
  const errors: string[] = [];
  if (!supabase) {
    return { issued: 0, errors: ["Database is not configured."] };
  }
  const { data: members, error } = await supabase
    .from("members")
    .select(
      "user_id, plan_id, billing_method, subscription_status, period_end",
    )
    .eq("subscription_status", "active")
    .in("billing_method", ["stripe", "wallet"])
    .not("period_end", "is", null);
  if (error) {
    return { issued: 0, errors: [error.message] };
  }
  let issued = 0;
  for (const row of members ?? []) {
    const userId = String(row.user_id);
    const method = parseBillingMethod(row.billing_method);
    const periodEndMs = Date.parse(String(row.period_end ?? ""));
    if (!method || !Number.isFinite(periodEndMs)) {
      continue;
    }
    const loaded = await getMembershipPlan(String(row.plan_id));
    if (!loaded.ok || loaded.plan.priceUsd < 0.01) {
      continue;
    }
    const cycle = renewalCycleFromPeriodEnd(periodEndMs);
    const externalId = renewalExternalId(
      userId,
      new Date(cycle.periodStartMs).toISOString(),
    );
    const { data: existingRows } = await supabase
      .from("membership_invoices")
      .select("external_id, period_start, status")
      .eq("user_id", userId)
      .in("status", ["open", "paid"]);
    const alreadyIssued = renewalAlreadyCovered(
      (existingRows ?? []).map((row) => ({
        externalId: typeof row.external_id === "string" ? row.external_id : null,
        periodStart:
          typeof row.period_start === "string" ? row.period_start : null,
        status: String(row.status),
      })),
      { externalId, periodStartMs: cycle.periodStartMs },
    );
    if (
      !shouldIssueRenewalInvoice({
        nowMs,
        periodEndMs,
        planPriceUsd: loaded.plan.priceUsd,
        alreadyIssued,
      })
    ) {
      continue;
    }
    const created = await createOpenRenewalInvoice({
      userId,
      planId: loaded.plan.id,
      method,
      externalId,
      amountUsd: roundUsd(loaded.plan.priceUsd),
      periodStart: new Date(cycle.periodStartMs).toISOString(),
      periodEnd: new Date(cycle.periodEndMs).toISOString(),
      dueAt: new Date(cycle.dueAtMs).toISOString(),
    });
    if (!created.ok) {
      errors.push(created.error);
      continue;
    }
    if (created.created) {
      issued += 1;
      await writeEventLog({
        scope: "system",
        event: "membership.invoice_issued",
        message: `Issued ${method} renewal invoice`,
        userId,
        data: { invoiceId: created.invoiceId, externalId, method },
      });
    }
  }
  return { issued, errors };
}

export async function collectOpenWalletInvoices(input?: {
  nowMs?: number;
  userIds?: string[];
}): Promise<{ collected: number; errors: string[] }> {
  const nowMs = input?.nowMs ?? Date.now();
  const open = await listOpenInvoices("wallet", input?.userIds);
  const errors: string[] = [];
  let collected = 0;
  for (const invoice of open) {
    if (!openInvoiceIsDue(invoice, nowMs)) {
      continue;
    }
    const paid = await tryCollectWalletInvoice(invoice);
    if (!paid.ok) {
      if (paid.skip) {
        continue;
      }
      errors.push(paid.error);
      continue;
    }
    collected += 1;
  }
  return { collected, errors };
}

async function tryCollectWalletInvoice(
  invoice: OpenInvoiceRow,
): Promise<{ ok: true } | { ok: false; skip?: boolean; error: string }> {
  const [billing, books, payable, loaded] = await Promise.all([
    getMemberBilling(invoice.userId),
    loadBooks(invoice.userId),
    loadPayable(invoice.userId),
    getMembershipPlan(invoice.planId),
  ]);
  if (!billing || !loaded.ok) {
    return { ok: false, skip: true, error: "Member or plan missing." };
  }
  const useAffiliate =
    billing.paySubscriptionFromAffiliate === true &&
    loaded.plan.features.affiliate_pay_subscription;
  const deduct = planDeductDecision({
    priceUsd: invoice.amountUsd,
    mainUsd: books.main,
    affiliateUsd: payable,
    useAffiliate,
  });
  if (!deduct.ok) {
    return { ok: false, skip: true, error: "Short Account Balance." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase.rpc("collect_open_membership_invoice", {
    p_invoice_id: invoice.id,
    p_transfer_usd: deduct.transferUsd,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const invoiceId = typeof data === "string" ? data : invoice.id;
  const commissions = await createCommissionsForInvoice({
    invoiceId,
    sourceUserId: invoice.userId,
    method: "wallet",
    status: "paid",
    amountUsd: invoice.amountUsd,
  });
  if (!commissions.ok) {
    return { ok: false, error: commissions.error };
  }
  await writeEventLog({
    scope: "system",
    event: "membership.invoice_paid",
    message: "Collected crypto renewal invoice",
    userId: invoice.userId,
    data: {
      invoiceId,
      transferUsd: deduct.transferUsd,
      amountUsd: invoice.amountUsd,
    },
  });
  return { ok: true };
}

async function createOpenRenewalInvoice(input: {
  userId: string;
  planId: string;
  method: BillingMethod;
  externalId: string;
  amountUsd: number;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
}): Promise<
  | { ok: true; invoiceId: string; created: boolean }
  | { ok: false; error: string }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data: before } = await supabase
    .from("membership_invoices")
    .select("id")
    .eq("user_id", input.userId)
    .eq("external_id", input.externalId)
    .maybeSingle();
  const { data, error } = await supabase.rpc("create_open_membership_invoice", {
    p_user_id: input.userId,
    p_plan_id: input.planId,
    p_method: input.method,
    p_external_id: input.externalId,
    p_amount_usd: input.amountUsd,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_due_at: input.dueAt,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  if (typeof data !== "string" || !data) {
    return { ok: false, error: "Invoice was not created." };
  }
  return { ok: true, invoiceId: data, created: !before?.id };
}

export async function listOpenInvoices(
  method?: BillingMethod,
  userIds?: string[],
): Promise<OpenInvoiceRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  let query = supabase
    .from("membership_invoices")
    .select(
      "id, user_id, plan_id, method, amount_usd, period_start, period_end, due_at",
    )
    .eq("status", "open");
  if (method) {
    query = query.eq("method", method);
  }
  if (userIds && userIds.length > 0) {
    query = query.in("user_id", userIds);
  }
  const { data } = await query;
  return (data ?? []).flatMap((row) => {
    const parsed = parseBillingMethod(row.method);
    if (!parsed) {
      return [];
    }
    return [
      {
        id: String(row.id),
        userId: String(row.user_id),
        planId: String(row.plan_id),
        method: parsed,
        amountUsd: Number(row.amount_usd),
        periodStart:
          typeof row.period_start === "string" ? row.period_start : null,
        periodEnd: typeof row.period_end === "string" ? row.period_end : null,
        dueAt: typeof row.due_at === "string" ? row.due_at : null,
      },
    ];
  });
}

export async function markOpenStripeInvoicePaid(input: {
  userId: string;
  stripeInvoiceId: string;
  amountUsd: number;
  periodStartMs: number | null;
  periodEnd: string | null;
  planId: string;
}): Promise<{ matched: boolean } | { ok: false; error: string }> {
  const open = await listOpenInvoices("stripe", [input.userId]);
  const invoiceId = matchOpenRenewalInvoice(open, {
    amountUsd: input.amountUsd,
    periodStartMs: input.periodStartMs,
  });
  if (!invoiceId) {
    return { matched: false };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("membership_invoices")
    .update({
      status: "paid",
      external_id: input.stripeInvoiceId,
      period_end: input.periodEnd,
    })
    .eq("id", invoiceId)
    .eq("status", "open");
  if (error) {
    if (error.code === "23505") {
      await supabase
        .from("membership_invoices")
        .update({ status: "void" })
        .eq("id", invoiceId)
        .eq("status", "open");
      return { matched: true };
    }
    return { ok: false, error: error.message };
  }
  if (input.periodEnd) {
    await supabase
      .from("members")
      .update({
        plan_id: input.planId,
        subscription_status: "active",
        period_end: input.periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", input.userId);
  }
  const commissions = await createCommissionsForInvoice({
    invoiceId,
    sourceUserId: input.userId,
    method: "stripe",
    status: "paid",
    amountUsd: input.amountUsd,
  });
  if (!commissions.ok) {
    return commissions;
  }
  return { matched: true };
}
