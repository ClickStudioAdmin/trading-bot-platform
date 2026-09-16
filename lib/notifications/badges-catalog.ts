import type { AdminActionCounts, MemberActionCounts } from "./badge-model";

export const BADGE_IDS = [
  "past_due",
  "account_shortfall",
  "unbound_live",
  "desk_critical",
  "copy_invite",
  "update_card",
  "affiliate_payouts",
  "wallet_withdraws",
  "sweep_failed",
  "gas_low",
  "past_due_members",
  "admin_desk_critical",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export type BadgeAudience = "member" | "admin";

export type BadgeSetting = {
  id: BadgeId;
  label: string;
  hint: string;
  audience: BadgeAudience;
};

export const BADGE_SETTINGS: BadgeSetting[] = [
  {
    id: "past_due",
    label: "Subscription past due",
    hint: "Member Overview and Billing.",
    audience: "member",
  },
  {
    id: "account_shortfall",
    label: "Account Balance shortfall",
    hint: "Member Overview and Billing while a collect window is open.",
    audience: "member",
  },
  {
    id: "unbound_live",
    label: "Unbound live desk",
    hint: "Member Overview. Already listed under Attention.",
    audience: "member",
  },
  {
    id: "desk_critical",
    label: "Live desk critical",
    hint: "Member Overview. Sync fail, repeating reject, or key verify.",
    audience: "member",
  },
  {
    id: "copy_invite",
    label: "Copy invite waiting",
    hint: "Member Overview.",
    audience: "member",
  },
  {
    id: "update_card",
    label: "Update card",
    hint: "Member Billing. Off until commercial notify is wired.",
    audience: "member",
  },
  {
    id: "affiliate_payouts",
    label: "Affiliate payouts to send",
    hint: "Admin Overview and Affiliates.",
    audience: "admin",
  },
  {
    id: "wallet_withdraws",
    label: "Account Balance withdraws",
    hint: "Admin Overview and Billing.",
    audience: "admin",
  },
  {
    id: "sweep_failed",
    label: "Sweep leftover",
    hint: "Admin Overview and Billing. Credited deposits still unswept.",
    audience: "admin",
  },
  {
    id: "gas_low",
    label: "Gas wallet low",
    hint: "Admin Overview and Billing.",
    audience: "admin",
  },
  {
    id: "past_due_members",
    label: "Members past due",
    hint: "Admin Overview and Members.",
    audience: "admin",
  },
  {
    id: "admin_desk_critical",
    label: "Live desk critical",
    hint: "Admin Overview. Distinct live desks with a critical log.",
    audience: "admin",
  },
];

export function isBadgeId(value: string): value is BadgeId {
  return (BADGE_IDS as readonly string[]).includes(value);
}

export function badgeIsDisabled(
  disabled: readonly string[],
  id: BadgeId,
): boolean {
  return disabled.includes(id);
}

export function gatedBadgeCount(
  live: number,
  disabled: boolean,
  demo = 0,
): number {
  if (disabled) {
    return 0;
  }
  return Math.max(0, Math.trunc(live), Math.trunc(demo));
}

export function demoBadgesAllowed(
  env: { VERCEL_ENV?: string | undefined } = {
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
): boolean {
  return env.VERCEL_ENV !== "production";
}

export const AFFILIATE_BADGE_IDS: readonly BadgeId[] = ["affiliate_payouts"];

export const MEMBER_BADGE_SETTINGS = BADGE_SETTINGS.filter(
  (row) => row.audience === "member",
);

export const AFFILIATE_BADGE_SETTINGS = BADGE_SETTINGS.filter((row) =>
  AFFILIATE_BADGE_IDS.includes(row.id),
);

export const ADMIN_BADGE_SETTINGS = BADGE_SETTINGS.filter(
  (row) =>
    row.audience === "admin" && !AFFILIATE_BADGE_IDS.includes(row.id),
);

export function applyMemberBadgeGates(
  actions: MemberActionCounts,
  disabled: readonly string[],
  demo: Record<string, number> = {},
  allowDemo = demoBadgesAllowed(),
): MemberActionCounts {
  const count = (id: BadgeId, live: number) =>
    gatedBadgeCount(
      live,
      badgeIsDisabled(disabled, id),
      allowDemo ? (demo[id] ?? 0) : 0,
    );
  return {
    pastDue: count("past_due", actions.pastDue),
    accountShortfall: count("account_shortfall", actions.accountShortfall),
    unboundLive: count("unbound_live", actions.unboundLive),
    deskCritical: count("desk_critical", actions.deskCritical),
    copyInvite: count("copy_invite", actions.copyInvite),
    updateCard: count("update_card", actions.updateCard),
  };
}

export function applyAdminBadgeGates(
  actions: AdminActionCounts,
  disabled: readonly string[],
  demo: Record<string, number> = {},
  allowDemo = demoBadgesAllowed(),
): AdminActionCounts {
  const count = (id: BadgeId, live: number) =>
    gatedBadgeCount(
      live,
      badgeIsDisabled(disabled, id),
      allowDemo ? (demo[id] ?? 0) : 0,
    );
  return {
    affiliatePayouts: count("affiliate_payouts", actions.affiliatePayouts),
    walletWithdraws: count("wallet_withdraws", actions.walletWithdraws),
    sweepFailed: count("sweep_failed", actions.sweepFailed),
    gasLow: count("gas_low", actions.gasLow),
    pastDueMembers: count("past_due_members", actions.pastDueMembers),
    deskCritical: count("admin_desk_critical", actions.deskCritical),
  };
}

export const SAMPLE_BADGE_COUNTS: Record<BadgeId, number> = {
  past_due: 1,
  account_shortfall: 1,
  unbound_live: 2,
  desk_critical: 2,
  copy_invite: 3,
  update_card: 1,
  affiliate_payouts: 4,
  wallet_withdraws: 2,
  sweep_failed: 1,
  gas_low: 1,
  past_due_members: 2,
  admin_desk_critical: 3,
};
