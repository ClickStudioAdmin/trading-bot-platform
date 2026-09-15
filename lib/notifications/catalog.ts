export const NOTIFICATION_IDS = [
  "invoice_issued",
  "invoice_paid",
  "payment_failed",
  "subscription_past_due",
  "deposit_credited",
  "account_shortfall",
  "commission_released",
  "payout_requested",
  "payout_paid",
  "payout_rejected",
  "copy_invite_received",
  "copy_invite_revoked",
  "desk_sync_failed",
  "desk_order_failed",
  "exchange_verify_failed",
  "password_changed",
  "operator_payout_requested",
  "operator_sweep_failed",
  "operator_gas_low",
  "operator_payment_failed",
  "operator_desk_critical",
] as const;

export type NotificationId = (typeof NOTIFICATION_IDS)[number];

const EMAIL_DEFAULT_ON = new Set<NotificationId>([
  "payment_failed",
  "subscription_past_due",
  "account_shortfall",
  "payout_rejected",
  "copy_invite_received",
  "desk_sync_failed",
  "desk_order_failed",
  "exchange_verify_failed",
  "password_changed",
  "operator_payout_requested",
  "operator_sweep_failed",
  "operator_gas_low",
  "operator_payment_failed",
  "operator_desk_critical",
]);

const AFFILIATE_ONLY_IDS = new Set<NotificationId>([
  "commission_released",
  "payout_requested",
  "payout_paid",
  "payout_rejected",
  "password_changed",
]);

export function isNotificationId(value: string): value is NotificationId {
  return (NOTIFICATION_IDS as readonly string[]).includes(value);
}

export function isOperatorNotificationId(id: NotificationId): boolean {
  return id.startsWith("operator_");
}

export function emailDefaultOn(id: NotificationId): boolean {
  return EMAIL_DEFAULT_ON.has(id);
}

export function emailIsMuteable(id: NotificationId): boolean {
  return id !== "password_changed";
}

export function notificationIsDisabled(
  disabled: readonly string[],
  template: string,
): boolean {
  return disabled.includes(template);
}

export function memberNotificationIds(affiliateOnly = false): NotificationId[] {
  return NOTIFICATION_IDS.filter((id) => {
    if (isOperatorNotificationId(id)) {
      return false;
    }
    if (affiliateOnly) {
      return AFFILIATE_ONLY_IDS.has(id);
    }
    return true;
  });
}

export function operatorNotificationIds(): NotificationId[] {
  return NOTIFICATION_IDS.filter(isOperatorNotificationId);
}

export type EmailSendDecision =
  | { send: true }
  | { send: false; reason: "platform" | "user" | "resend" | "no_recipient" };

export function emailShouldSend(input: {
  template: NotificationId;
  toEmail?: string | null;
  platformDisabled: readonly string[];
  userDisabledEmails: readonly string[];
  resendConfigured: boolean;
}): EmailSendDecision {
  const to = String(input.toEmail ?? "")
    .trim()
    .toLowerCase();
  if (!to.includes("@")) {
    return { send: false, reason: "no_recipient" };
  }
  if (notificationIsDisabled(input.platformDisabled, input.template)) {
    return { send: false, reason: "platform" };
  }
  if (
    emailIsMuteable(input.template) &&
    !isOperatorNotificationId(input.template) &&
    notificationIsDisabled(input.userDisabledEmails, input.template)
  ) {
    return { send: false, reason: "user" };
  }
  if (!input.resendConfigured) {
    return { send: false, reason: "resend" };
  }
  return { send: true };
}

export function inboxShouldInsert(input: {
  template: NotificationId;
  userDisabledInApp: readonly string[];
}): boolean {
  if (isOperatorNotificationId(input.template)) {
    return false;
  }
  return !notificationIsDisabled(input.userDisabledInApp, input.template);
}

export function resendConfigured(
  env: { RESEND_API_KEY?: string | undefined; EMAIL_FROM?: string | undefined } = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  },
): boolean {
  return Boolean(
    String(env.RESEND_API_KEY ?? "").trim() && String(env.EMAIL_FROM ?? "").trim(),
  );
}

export function dispatchDay(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function invoiceIssuedKey(invoiceId: string): string {
  return `invoice:${invoiceId}`;
}

export function invoicePaidKey(invoiceId: string): string {
  return `invoice-paid:${invoiceId}`;
}

export function paymentFailedKey(
  invoiceOrIntentId: string,
  nowMs = Date.now(),
): string {
  return `payment-failed:${invoiceOrIntentId}:${dispatchDay(nowMs)}`;
}

export function pastDueKey(userId: string, periodEnd: string): string {
  return `past-due:${userId}:${periodEnd}`;
}

export function depositCreditedKey(
  chain: string,
  txHash: string,
  logIndex: number | string,
): string {
  return `deposit:${chain}:${txHash}:${logIndex}`;
}

export function accountShortfallKey(userId: string, invoiceId: string): string {
  return `shortfall:${userId}:${invoiceId}`;
}

export function commissionReleasedKey(commissionId: string): string {
  return `commission:${commissionId}`;
}

export function payoutRequestedKey(payoutId: string): string {
  return `payout:${payoutId}`;
}

export function payoutPaidKey(payoutId: string): string {
  return `payout-paid:${payoutId}`;
}

export function payoutRejectedKey(payoutId: string): string {
  return `payout-rejected:${payoutId}`;
}

export function copyInviteKey(shareId: string): string {
  return `copy-invite:${shareId}`;
}

export function copyInviteRevokedKey(shareId: string): string {
  return `copy-invite-revoked:${shareId}`;
}

export function deskSyncFailedKey(
  accountId: string,
  nowMs = Date.now(),
): string {
  return `desk-sync:${accountId}:${dispatchDay(nowMs)}`;
}

export function deskOrderFailedKey(
  accountId: string,
  family: string,
  nowMs = Date.now(),
): string {
  return `desk-order:${accountId}:${family}:${dispatchDay(nowMs)}`;
}

export function exchangeVerifyFailedKey(
  connectionId: string,
  nowMs = Date.now(),
): string {
  return `exchange-verify:${connectionId}:${dispatchDay(nowMs)}`;
}

export function passwordChangedKey(
  userId: string,
  changedAtMs: number,
): string {
  const minute = new Date(changedAtMs).toISOString().slice(0, 16);
  return `password:${userId}:${minute}`;
}

export function operatorPayoutKey(payoutId: string): string {
  return `op-payout:${payoutId}`;
}

export function operatorSweepKey(depositTxId: string): string {
  return `op-sweep:${depositTxId}`;
}

export function operatorGasLowKey(chain: string, nowMs = Date.now()): string {
  return `op-gas:${chain}:${dispatchDay(nowMs)}`;
}

export function operatorPaymentFailedKey(
  userId: string,
  invoiceOrDay: string,
): string {
  return `op-pay:${userId}:${invoiceOrDay}`;
}

export function operatorDeskCriticalKey(
  accountId: string,
  family: string,
  nowMs = Date.now(),
): string {
  return `op-desk:${accountId}:${family}:${dispatchDay(nowMs)}`;
}

export function payoutMemberHref(book: "main" | "affiliate"): string {
  return book === "main"
    ? "/account/billing?tab=wallet"
    : "/affiliates?tab=payouts";
}

export function payoutOperatorHref(book: "main" | "affiliate"): string {
  return book === "main"
    ? "/admin/billing?tab=withdrawals"
    : "/admin/affiliates";
}
