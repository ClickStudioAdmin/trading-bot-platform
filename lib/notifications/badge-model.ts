import type { OverviewAttention } from "@/lib/accounts/model";
import { overviewAttentionItems } from "@/lib/accounts/model";

export type MemberActionCounts = {
  pastDue: number;
  accountShortfall: number;
  unboundLive: number;
  deskCritical: number;
  copyInvite: number;
  updateCard: number;
};

export type AdminActionCounts = {
  affiliatePayouts: number;
  walletWithdraws: number;
  sweepFailed: number;
  gasLow: number;
  pastDueMembers: number;
  deskCritical: number;
};

export const EMPTY_MEMBER_ACTIONS: MemberActionCounts = {
  pastDue: 0,
  accountShortfall: 0,
  unboundLive: 0,
  deskCritical: 0,
  copyInvite: 0,
  updateCard: 0,
};

export const EMPTY_ADMIN_ACTIONS: AdminActionCounts = {
  affiliatePayouts: 0,
  walletWithdraws: 0,
  sweepFailed: 0,
  gasLow: 0,
  pastDueMembers: 0,
  deskCritical: 0,
};

export function formatNavBadgeCount(count: number): string | null {
  const n = Math.max(0, Math.trunc(count));
  if (n <= 0) {
    return null;
  }
  return n > 99 ? "99+" : String(n);
}

export function memberActionTotal(counts: MemberActionCounts): number {
  return (
    counts.pastDue +
    counts.accountShortfall +
    counts.unboundLive +
    counts.deskCritical +
    counts.copyInvite +
    counts.updateCard
  );
}

export function memberBillingActionTotal(counts: MemberActionCounts): number {
  return counts.pastDue + counts.accountShortfall + counts.updateCard;
}

export function memberBillingTabCounts(counts: MemberActionCounts): {
  overview: number;
  invoices: number;
  method: number;
  wallet: number;
  ledger: number;
} {
  return {
    overview: counts.pastDue,
    invoices: 0,
    method: counts.updateCard,
    wallet: counts.accountShortfall,
    ledger: 0,
  };
}

export function adminBillingTabCounts(counts: AdminActionCounts): {
  overview: number;
  invoices: number;
  withdrawals: number;
} {
  return {
    overview: counts.sweepFailed + counts.gasLow,
    invoices: 0,
    withdrawals: counts.walletWithdraws,
  };
}

export function adminActionTotal(counts: AdminActionCounts): number {
  return (
    counts.affiliatePayouts +
    counts.walletWithdraws +
    counts.sweepFailed +
    counts.gasLow +
    counts.pastDueMembers +
    counts.deskCritical
  );
}

export function deskActionCountsFromAttention(input: {
  accounts: readonly {
    id: string;
    name: string;
    mode: "paper" | "live";
    venue?: string;
  }[];
  binds: readonly { connectionId: string; accountId: string }[];
}): Pick<MemberActionCounts, "unboundLive"> {
  const boundIds = new Set(input.binds.map((bind) => bind.accountId));
  const unboundLive = input.accounts.filter(
    (account) => account.mode === "live" && !boundIds.has(account.id),
  ).length;
  return { unboundLive };
}

export function notificationAttentionItems(input: {
  pastDue: boolean;
  accountShortfall: boolean;
  copyInvite: number;
  updateCard: boolean;
  deskCritical?: number;
}): OverviewAttention[] {
  const items: OverviewAttention[] = [];
  if (input.pastDue) {
    items.push({
      label: "Your subscription is past due.",
      href: "/account/billing",
    });
  }
  if (input.updateCard && !input.pastDue) {
    items.push({
      label: "Update the card on this login.",
      href: "/account/billing?tab=method",
    });
  }
  if (input.accountShortfall) {
    items.push({
      label: "Account Balance is short for your next payment.",
      href: "/account/billing?tab=wallet",
    });
  }
  if (input.deskCritical === 1) {
    items.push({
      label: "One live desk has a critical issue.",
      href: "/account",
    });
  } else if (input.deskCritical && input.deskCritical > 1) {
    items.push({
      label: `${input.deskCritical} live desks have a critical issue.`,
      href: "/account",
    });
  }
  if (input.copyInvite === 1) {
    items.push({
      label: "One copy invite is waiting.",
      href: "/account/copy",
    });
  } else if (input.copyInvite > 1) {
    items.push({
      label: `${input.copyInvite} copy invites are waiting.`,
      href: "/account/copy",
    });
  }
  return items;
}

export function adminOverviewAttention(
  counts: AdminActionCounts,
): OverviewAttention[] {
  const items: OverviewAttention[] = [];
  if (counts.affiliatePayouts === 1) {
    items.push({
      label: "One affiliate payout is waiting to send.",
      href: "/admin/affiliates",
    });
  } else if (counts.affiliatePayouts > 1) {
    items.push({
      label: `${counts.affiliatePayouts} affiliate payouts are waiting to send.`,
      href: "/admin/affiliates",
    });
  }
  if (counts.walletWithdraws === 1) {
    items.push({
      label: "One Account Balance withdraw is waiting.",
      href: "/admin/billing?tab=withdrawals",
    });
  } else if (counts.walletWithdraws > 1) {
    items.push({
      label: `${counts.walletWithdraws} Account Balance withdraws are waiting.`,
      href: "/admin/billing?tab=withdrawals",
    });
  }
  if (counts.sweepFailed === 1) {
    items.push({
      label: "One credited deposit did not sweep.",
      href: "/admin/billing",
    });
  } else if (counts.sweepFailed > 1) {
    items.push({
      label: `${counts.sweepFailed} credited deposits did not sweep.`,
      href: "/admin/billing",
    });
  }
  if (counts.gasLow === 1) {
    items.push({
      label: "The gas wallet is low on one chain.",
      href: "/admin/billing",
    });
  } else if (counts.gasLow > 1) {
    items.push({
      label: `The gas wallet is low on ${counts.gasLow} chains.`,
      href: "/admin/billing",
    });
  }
  if (counts.pastDueMembers === 1) {
    items.push({
      label: "One member is past due.",
      href: "/admin/members",
    });
  } else if (counts.pastDueMembers > 1) {
    items.push({
      label: `${counts.pastDueMembers} members are past due.`,
      href: "/admin/members",
    });
  }
  if (counts.deskCritical === 1) {
    items.push({
      label: "One live desk has a critical issue.",
      href: "/admin/logs?level=error",
    });
  } else if (counts.deskCritical > 1) {
    items.push({
      label: `${counts.deskCritical} live desks have a critical issue.`,
      href: "/admin/logs?level=error",
    });
  }
  return items;
}

export function memberOverviewAttention(input: {
  accounts: readonly {
    id: string;
    name: string;
    mode: "paper" | "live";
    venue?: string;
  }[];
  binds: readonly { connectionId: string; accountId: string }[];
  pastDue: boolean;
  accountShortfall: boolean;
  copyInvite: number;
  updateCard: boolean;
  deskCritical?: number;
}): OverviewAttention[] {
  return [
    ...notificationAttentionItems({
      pastDue: input.pastDue,
      accountShortfall: input.accountShortfall,
      copyInvite: input.copyInvite,
      updateCard: input.updateCard,
      deskCritical: input.deskCritical,
    }),
    ...overviewAttentionItems({
      accounts: input.accounts,
      binds: input.binds,
    }),
  ];
}
