import {
  emailDefaultOn,
  emailIsMuteable,
  isOperatorNotificationId,
  memberNotificationIds,
  type NotificationId,
} from "./catalog";

export type NotificationAudience = "member" | "operator";

export type NotificationSettingGroup = {
  id: string;
  label: string;
  ids: NotificationId[];
  platformOnly?: boolean;
};

export const NOTIFICATION_LABELS: Record<NotificationId, string> = {
  invoice_issued: "Invoice issued",
  invoice_paid: "Payment received",
  payment_failed: "Payment failed",
  subscription_past_due: "Subscription past due",
  deposit_credited: "Account Balance credited",
  account_shortfall: "Account Balance shortfall",
  commission_released: "Commission released",
  payout_requested: "Withdraw requested",
  payout_paid: "Withdraw paid",
  payout_rejected: "Withdraw rejected",
  copy_invite_received: "Copy invite received",
  copy_invite_revoked: "Copy invite withdrawn",
  desk_sync_failed: "Desk sync failed",
  desk_order_failed: "Live order failed",
  exchange_verify_failed: "Exchange key failed",
  password_changed: "Password changed",
  operator_payout_requested: "Payout to send",
  operator_sweep_failed: "Sweep failed",
  operator_gas_low: "Gas wallet low",
  operator_payment_failed: "Member payment failed",
  operator_desk_critical: "Live desk issue",
};

export const NOTIFICATION_HINTS: Record<NotificationId, string> = {
  invoice_issued: "A renewal invoice is open.",
  invoice_paid: "We recorded a subscription payment.",
  payment_failed: "Card or Crypto collect did not succeed.",
  subscription_past_due: "Withdraws stay locked until this is paid.",
  deposit_credited: "A crypto deposit hit Account Balance.",
  account_shortfall: "Account Balance cannot cover the next collect.",
  commission_released: "Held commission moved to the Affiliate book.",
  payout_requested: "A USDT withdraw is queued.",
  payout_paid: "A USDT withdraw was marked paid.",
  payout_rejected: "A USDT withdraw was rejected and returned.",
  copy_invite_received: "Someone invited this login to copy a desk.",
  copy_invite_revoked: "A copy invite was withdrawn.",
  desk_sync_failed: "A live desk could not sync with the venue.",
  desk_order_failed: "A live desk hit a repeating reject.",
  exchange_verify_failed: "An exchange key failed verification.",
  password_changed: "This login’s password was changed. Email stays on.",
  operator_payout_requested: "A member asked for a USDT payout.",
  operator_sweep_failed: "A credited deposit did not sweep.",
  operator_gas_low: "The gas wallet is below the threshold.",
  operator_payment_failed: "A member payment failed.",
  operator_desk_critical: "A live desk is failing.",
};

export const MEMBER_NOTIFICATION_GROUPS: NotificationSettingGroup[] = [
  {
    id: "billing",
    label: "Billing",
    ids: [
      "invoice_issued",
      "invoice_paid",
      "payment_failed",
      "subscription_past_due",
      "deposit_credited",
      "account_shortfall",
    ],
  },
  {
    id: "payouts",
    label: "Payouts",
    ids: [
      "commission_released",
      "payout_requested",
      "payout_paid",
      "payout_rejected",
    ],
  },
  {
    id: "copy",
    label: "Copy trading",
    ids: ["copy_invite_received", "copy_invite_revoked"],
    platformOnly: true,
  },
  {
    id: "desk",
    label: "Desks",
    ids: [
      "desk_sync_failed",
      "desk_order_failed",
      "exchange_verify_failed",
    ],
    platformOnly: true,
  },
  {
    id: "security",
    label: "Security",
    ids: ["password_changed"],
  },
];

export const OPERATOR_NOTIFICATION_GROUP: NotificationSettingGroup = {
  id: "operator",
  label: "Operators",
  ids: [
    "operator_payout_requested",
    "operator_sweep_failed",
    "operator_gas_low",
    "operator_payment_failed",
    "operator_desk_critical",
  ],
};

export function notificationAudience(
  id: NotificationId,
): NotificationAudience {
  return isOperatorNotificationId(id) ? "operator" : "member";
}

export function memberSettingGroups(
  affiliateOnly: boolean,
): NotificationSettingGroup[] {
  return MEMBER_NOTIFICATION_GROUPS.filter(
    (group) => !affiliateOnly || !group.platformOnly,
  ).map((group) => ({
    ...group,
    ids: group.ids.filter((id) =>
      memberNotificationIds(affiliateOnly).includes(id),
    ),
  }));
}

export function adminSettingGroups(): NotificationSettingGroup[] {
  return [...MEMBER_NOTIFICATION_GROUPS, OPERATOR_NOTIFICATION_GROUP];
}

export function emailSwitchDefaultOn(id: NotificationId): boolean {
  return emailDefaultOn(id);
}

export function emailSwitchLockedOn(id: NotificationId): boolean {
  return !emailIsMuteable(id);
}

export function inAppSwitchDefaultOn(): boolean {
  return true;
}
