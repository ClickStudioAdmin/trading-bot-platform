import type { BadgeId } from "./badges-catalog";
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
  payout_requested: "An Affiliate or Account Balance USDT withdraw is queued.",
  payout_paid: "An Affiliate or Account Balance USDT withdraw was marked paid.",
  payout_rejected:
    "An Affiliate or Account Balance USDT withdraw was rejected and returned.",
  copy_invite_received: "Someone invited this login to copy a desk.",
  copy_invite_revoked: "A copy invite was withdrawn.",
  desk_sync_failed: "A live desk could not sync with the venue.",
  desk_order_failed: "A live desk hit a repeating reject.",
  exchange_verify_failed: "An exchange key failed verification.",
  password_changed:
    "This login’s password was changed. Members cannot mute the email.",
  operator_payout_requested:
    "A member asked for an Affiliate or Account Balance USDT payout.",
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
    platformOnly: true,
  },
  {
    id: "affiliates",
    label: "Affiliates",
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

export const ADMIN_NOTIFICATION_GROUP: NotificationSettingGroup = {
  id: "admin",
  label: "Admin emails",
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
  )
    .map((group) => ({
      ...group,
      ids: group.ids.filter((id) =>
        memberNotificationIds(affiliateOnly).includes(id),
      ),
    }))
    .filter((group) => group.ids.length > 0);
}

export function adminSettingGroups(): NotificationSettingGroup[] {
  return [ADMIN_NOTIFICATION_GROUP, ...MEMBER_NOTIFICATION_GROUPS];
}

export type ChannelRow = {
  id: string;
  label: string;
  hint: string;
  emailId?: NotificationId;
  showInApp: boolean;
  badgeId?: BadgeId;
};

export type ChannelGroup = {
  id: string;
  label: string;
  rows: ChannelRow[];
};

export type ChannelList = {
  id: "member" | "admin";
  label: string;
  showInApp: boolean;
  groups: ChannelGroup[];
};

export const MEMBER_CHANNEL_LIST: ChannelList = {
  id: "member",
  label: "Member Notifications and Alerts",
  showInApp: true,
  groups: [
    {
      id: "billing",
      label: "Billing",
      rows: [
        row("invoice_issued"),
        row("invoice_paid"),
        row("payment_failed"),
        row("subscription_past_due", "past_due"),
        row("deposit_credited"),
        row("account_shortfall", "account_shortfall"),
      ],
    },
    {
      id: "affiliates",
      label: "Affiliates",
      rows: [
        row("commission_released"),
        row("payout_requested"),
        row("payout_paid"),
        row("payout_rejected"),
      ],
    },
    {
      id: "copy",
      label: "Copy trading",
      rows: [
        row("copy_invite_received", "copy_invite"),
        row("copy_invite_revoked"),
      ],
    },
    {
      id: "desk",
      label: "Desks",
      rows: [
        {
          ...row("desk_sync_failed", "desk_critical"),
          hint: "Email for a sync fail. Alert is the live-desk badge (sync, repeating reject, or key verify).",
        },
        row("desk_order_failed"),
        row("exchange_verify_failed"),
        {
          id: "unbound_live",
          label: "Unbound live desk",
          hint: "Overview Attention. No email.",
          showInApp: false,
          badgeId: "unbound_live",
        },
        {
          id: "shared_key",
          label: "Shared exchange key",
          hint: "Overview Attention. One key bound to more than one desk.",
          showInApp: false,
          badgeId: "shared_key",
        },
      ],
    },
    {
      id: "security",
      label: "Security",
      rows: [row("password_changed")],
    },
    {
      id: "card",
      label: "Card",
      rows: [
        {
          id: "update_card",
          label: "Update card",
          hint: "Member Billing. Off until commercial notify is wired.",
          showInApp: false,
          badgeId: "update_card",
        },
      ],
    },
  ],
};

export const ADMIN_CHANNEL_LIST: ChannelList = {
  id: "admin",
  label: "Admin Notifications and Alerts",
  showInApp: false,
  groups: [
    {
      id: "payouts",
      label: "Payouts",
      rows: [
        {
          ...row("operator_payout_requested", "affiliate_payouts", false),
          hint: "Email when any USDT payout is requested. Alert is affiliate payouts waiting.",
        },
        {
          id: "wallet_withdraws",
          label: "Account Balance withdraws",
          hint: "Admin Overview and Billing. No separate email.",
          showInApp: false,
          badgeId: "wallet_withdraws",
        },
      ],
    },
    {
      id: "ops",
      label: "Operations",
      rows: [
        row("operator_sweep_failed", "sweep_failed", false),
        row("operator_gas_low", "gas_low", false),
        row("operator_payment_failed", "past_due_members", false),
        row("operator_desk_critical", "admin_desk_critical", false),
      ],
    },
  ],
};

function row(
  emailId: NotificationId,
  badgeId?: BadgeId,
  showInApp = true,
): ChannelRow {
  return {
    id: emailId,
    label: NOTIFICATION_LABELS[emailId],
    hint: NOTIFICATION_HINTS[emailId],
    emailId,
    showInApp,
    badgeId,
  };
}

export function channelLists(): ChannelList[] {
  return [MEMBER_CHANNEL_LIST, ADMIN_CHANNEL_LIST];
}

export function channelEmailIds(lists = channelLists()): NotificationId[] {
  const ids: NotificationId[] = [];
  for (const list of lists) {
    for (const group of list.groups) {
      for (const item of group.rows) {
        if (item.emailId) {
          ids.push(item.emailId);
        }
      }
    }
  }
  return ids;
}

export function channelBadgeIds(lists = channelLists()): BadgeId[] {
  const ids: BadgeId[] = [];
  for (const list of lists) {
    for (const group of list.groups) {
      for (const item of group.rows) {
        if (item.badgeId) {
          ids.push(item.badgeId);
        }
      }
    }
  }
  return ids;
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
