import { loadTradingAccountById } from "@/lib/accounts/store";
import { loadDeskCopyListing } from "@/lib/copy/listings";
import { loadTraderProfile } from "@/lib/copy/profile";
import { formatUsd, type BillingMethod } from "@/lib/membership/billing";
import { getMemberBilling } from "@/lib/membership/billing-store";
import { getMembershipPlan } from "@/lib/membership/store";
import { memberDisplayName } from "@/lib/members/sync";
import type { WalletBook } from "@/lib/membership/wallet";
import {
  accountShortfallKey,
  commissionReleasedKey,
  copyInviteKey,
  copyInviteRevokedKey,
  depositCreditedKey,
  invoiceIssuedKey,
  invoicePaidKey,
  operatorPaymentFailedKey,
  operatorPayoutKey,
  passwordChangedKey,
  pastDueKey,
  paymentFailedKey,
  payoutMemberHref,
  payoutOperatorHref,
  payoutPaidKey,
  payoutRejectedKey,
  payoutRequestedKey,
} from "./catalog";
import { notificationCopy } from "./copy";
import { loadPlatformName } from "@/lib/platform/brand";
import { notify } from "./notify";
import { loadOperatorEmails } from "./operators";

export function noticeDate(value: string | null | undefined): string {
  const ms = Date.parse(String(value ?? ""));
  if (!Number.isFinite(ms)) {
    return "—";
  }
  return new Date(ms).toISOString().slice(0, 10);
}

export function noticeAddressShort(address: string): string {
  const value = address.trim();
  if (value.length <= 10) {
    return value || "—";
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function payoutBookLabel(book: WalletBook): string {
  return book === "main" ? "Account Balance" : "Affiliate book";
}

export function memberNeedsCardUpdate(input: {
  billingMethod: BillingMethod | null;
  subscriptionStatus: string;
}): boolean {
  return (
    input.billingMethod === "stripe" && input.subscriptionStatus === "past_due"
  );
}

async function safeNotify(
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch {
    // Inbox and email must not fail the money or share write.
  }
}

async function memberMail(userId: string): Promise<{
  email: string;
  label: string;
  planName: string;
} | null> {
  const billing = await getMemberBilling(userId);
  if (!billing) {
    return null;
  }
  const plan = await getMembershipPlan(billing.planId);
  return {
    email: billing.email,
    label: memberDisplayName(billing.email, billing.name),
    planName: plan.ok ? plan.plan.name : "your plan",
  };
}

export async function notifyInvoiceIssued(input: {
  userId: string;
  invoiceId: string;
  planId: string;
  amountUsd: number;
  dueAt: string | null;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    const plan = await getMembershipPlan(input.planId);
    await notify({
      template: "invoice_issued",
      userId: input.userId,
      toEmail: member.email,
      entityKey: invoiceIssuedKey(input.invoiceId),
      notice: notificationCopy.invoice_issued({
        planName: plan.ok ? plan.plan.name : member.planName,
        amount: formatUsd(input.amountUsd),
        dueAt: noticeDate(input.dueAt),
      }),
    });
  });
}

export async function notifyInvoicePaid(input: {
  userId: string;
  invoiceId: string;
  planId?: string | null;
  amountUsd: number;
  periodEnd: string | null;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    const plan = input.planId
      ? await getMembershipPlan(input.planId)
      : null;
    await notify({
      template: "invoice_paid",
      userId: input.userId,
      toEmail: member.email,
      entityKey: invoicePaidKey(input.invoiceId),
      notice: notificationCopy.invoice_paid({
        planName: plan?.ok ? plan.plan.name : member.planName,
        amount: formatUsd(input.amountUsd),
        periodEnd: noticeDate(input.periodEnd),
      }),
    });
  });
}

export async function notifyPaymentFailed(input: {
  userId: string;
  invoiceOrIntentId: string;
  amountUsd: number;
  reason: string;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    const reason = input.reason.trim() || "Card or Crypto collect did not succeed.";
    await notify({
      template: "payment_failed",
      userId: input.userId,
      toEmail: member.email,
      entityKey: paymentFailedKey(input.invoiceOrIntentId),
      notice: notificationCopy.payment_failed({
        planName: member.planName,
        amount: formatUsd(input.amountUsd),
        reason,
      }),
    });
    const operators = await loadOperatorEmails();
    await notify({
      template: "operator_payment_failed",
      entityKey: operatorPaymentFailedKey(
        input.userId,
        input.invoiceOrIntentId,
      ),
      toEmail: operators,
      notice: notificationCopy.operator_payment_failed({
        memberLabel: member.label,
        planName: member.planName,
        amount: formatUsd(input.amountUsd),
        reason,
      }),
    });
  });
}

export async function notifySubscriptionPastDue(input: {
  userId: string;
  periodEnd: string | null;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    await notify({
      template: "subscription_past_due",
      userId: input.userId,
      toEmail: member.email,
      entityKey: pastDueKey(input.userId, input.periodEnd ?? "open"),
      notice: notificationCopy.subscription_past_due({
        planName: member.planName,
      }),
    });
  });
}

export async function notifyDepositCredited(input: {
  userId: string;
  chain: string;
  txHash: string;
  logIndex: number | string;
  amountUsd: number;
  token: string;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    await notify({
      template: "deposit_credited",
      userId: input.userId,
      toEmail: member.email,
      entityKey: depositCreditedKey(input.chain, input.txHash, input.logIndex),
      notice: notificationCopy.deposit_credited({
        amount: formatUsd(input.amountUsd),
        token: input.token,
      }),
    });
  });
}

export async function notifyAccountShortfall(input: {
  userId: string;
  invoiceId: string;
  amountUsd: number;
  mainUsd: number;
  shortUsd: number;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    await notify({
      template: "account_shortfall",
      userId: input.userId,
      toEmail: member.email,
      entityKey: accountShortfallKey(input.userId, input.invoiceId),
      notice: notificationCopy.account_shortfall({
        planName: member.planName,
        amount: formatUsd(input.amountUsd),
        mainUsd: formatUsd(input.mainUsd),
        shortUsd: formatUsd(input.shortUsd),
      }),
    });
  });
}

export async function notifyCommissionReleased(input: {
  userId: string;
  commissionId: string;
  amountUsd: number;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    await notify({
      template: "commission_released",
      userId: input.userId,
      toEmail: member.email,
      entityKey: commissionReleasedKey(input.commissionId),
      notice: notificationCopy.commission_released({
        amount: formatUsd(input.amountUsd),
      }),
    });
  });
}

export async function notifyPayoutRequested(input: {
  userId: string;
  payoutId: string;
  amountUsd: number;
  address: string;
  network: string;
  book: WalletBook;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    const href = payoutMemberHref(input.book);
    const addressShort = noticeAddressShort(input.address);
    const amount = formatUsd(input.amountUsd);
    await notify({
      template: "payout_requested",
      userId: input.userId,
      toEmail: member.email,
      entityKey: payoutRequestedKey(input.payoutId),
      notice: notificationCopy.payout_requested({
        amount,
        addressShort,
        network: input.network,
        href,
      }),
    });
    const operators = await loadOperatorEmails();
    await notify({
      template: "operator_payout_requested",
      entityKey: operatorPayoutKey(input.payoutId),
      toEmail: operators,
      notice: notificationCopy.operator_payout_requested({
        memberLabel: member.label,
        amount,
        bookLabel: payoutBookLabel(input.book),
        addressShort,
        network: input.network,
        href: payoutOperatorHref(input.book),
      }),
    });
  });
}

export async function notifyPayoutPaid(input: {
  userId: string;
  payoutId: string;
  amountUsd: number;
  address: string;
  network: string;
  book: WalletBook;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    await notify({
      template: "payout_paid",
      userId: input.userId,
      toEmail: member.email,
      entityKey: payoutPaidKey(input.payoutId),
      notice: notificationCopy.payout_paid({
        amount: formatUsd(input.amountUsd),
        addressShort: noticeAddressShort(input.address),
        network: input.network,
        href: payoutMemberHref(input.book),
      }),
    });
  });
}

export async function notifyPayoutRejected(input: {
  userId: string;
  payoutId: string;
  amountUsd: number;
  book: WalletBook;
  note?: string | null;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    const trimmed = String(input.note ?? "").trim();
    await notify({
      template: "payout_rejected",
      userId: input.userId,
      toEmail: member.email,
      entityKey: payoutRejectedKey(input.payoutId),
      notice: notificationCopy.payout_rejected({
        amount: formatUsd(input.amountUsd),
        bookLabel: payoutBookLabel(input.book),
        optionalNote: trimmed ? ` ${trimmed}` : "",
        href: payoutMemberHref(input.book),
      }),
    });
  });
}

export async function notifyCopyInviteReceived(input: {
  shareId: string;
  toUserId: string;
  fromUserId: string;
  parentAccountId: string;
}): Promise<void> {
  await safeNotify(async () => {
    const [member, listing, desk, trader] = await Promise.all([
      memberMail(input.toUserId),
      loadDeskCopyListing(input.parentAccountId),
      loadTradingAccountById(input.parentAccountId),
      loadTraderProfile(input.fromUserId),
    ]);
    if (!member) {
      return;
    }
    const deskName = listing?.name || desk?.name || "a desk";
    await notify({
      template: "copy_invite_received",
      userId: input.toUserId,
      toEmail: member.email,
      entityKey: copyInviteKey(input.shareId),
      notice: notificationCopy.copy_invite_received({
        deskName,
        traderAlias: trader?.alias || "A trader",
      }),
    });
  });
}

export async function notifyCopyInviteRevoked(input: {
  shareId: string;
  toUserId: string;
  parentAccountId: string;
}): Promise<void> {
  await safeNotify(async () => {
    const [member, listing, desk] = await Promise.all([
      memberMail(input.toUserId),
      loadDeskCopyListing(input.parentAccountId),
      loadTradingAccountById(input.parentAccountId),
    ]);
    if (!member) {
      return;
    }
    await notify({
      template: "copy_invite_revoked",
      userId: input.toUserId,
      toEmail: member.email,
      entityKey: copyInviteRevokedKey(input.shareId),
      notice: notificationCopy.copy_invite_revoked({
        deskName: listing?.name || desk?.name || "a desk",
      }),
    });
  });
}

export async function notifyPasswordChanged(input: {
  userId: string;
  changedAtMs?: number;
}): Promise<void> {
  await safeNotify(async () => {
    const member = await memberMail(input.userId);
    if (!member) {
      return;
    }
    await notify({
      template: "password_changed",
      userId: input.userId,
      toEmail: member.email,
      entityKey: passwordChangedKey(
        input.userId,
        input.changedAtMs ?? Date.now(),
      ),
      notice: notificationCopy.password_changed({
        platformName: await loadPlatformName(),
      }),
    });
  });
}
