import { cache } from "react";
import { listTradingAccounts } from "@/lib/accounts/store";
import { listConnectionDeskBinds } from "@/lib/exchanges/store";
import { openInvoiceIsCollectible } from "@/lib/membership/billing-cycle";
import { listOpenInvoices } from "@/lib/membership/billing-cycle-store";
import { getMemberBilling } from "@/lib/membership/billing-store";
import { accountShortfallUsd } from "@/lib/membership/wallet";
import { walletBookBalances } from "@/lib/membership/wallet-store";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  adminActionTotal,
  deskActionCountsFromAttention,
  EMPTY_MEMBER_ACTIONS,
  memberActionTotal,
  memberBillingActionTotal,
  type AdminActionCounts,
  type MemberActionCounts,
} from "./badge-model";
import {
  countAdminDeskCritical,
  countGasLow,
  countMemberDeskCritical,
  countSweepFailed,
} from "./critical";
import {
  applyAdminBadgeGates,
  applyMemberBadgeGates,
} from "./badges-catalog";
import { countUnreadUserNotifications, loadPlatformAlertSettings } from "./store";

const loadAlertGates = cache(loadPlatformAlertSettings);

export type { AdminActionCounts, MemberActionCounts };
export {
  adminActionTotal,
  deskActionCountsFromAttention,
  EMPTY_ADMIN_ACTIONS,
  EMPTY_MEMBER_ACTIONS,
  formatNavBadgeCount,
  adminBillingTabCounts,
  memberActionTotal,
  memberBillingActionTotal,
  memberBillingTabCounts,
  memberOverviewAttention,
  notificationAttentionItems,
} from "./badge-model";

export type MemberNotificationChrome = {
  unread: number;
  actions: MemberActionCounts;
  header: number;
  overview: number;
  billing: number;
  inbox: number;
};

export type AdminNotificationChrome = {
  actions: AdminActionCounts;
  header: number;
  overview: number;
  billing: number;
  affiliates: number;
  members: number;
};

function chromeFromMemberActions(
  actions: MemberActionCounts,
  unread: number,
): MemberNotificationChrome {
  return {
    unread,
    actions,
    header: unread,
    overview: memberActionTotal(actions),
    billing: memberBillingActionTotal(actions),
    inbox: unread,
  };
}

function chromeFromAdminActions(
  actions: AdminActionCounts,
): AdminNotificationChrome {
  return {
    actions,
    header: adminActionTotal(actions),
    overview: adminActionTotal(actions),
    billing: actions.walletWithdraws + actions.sweepFailed + actions.gasLow,
    affiliates: actions.affiliatePayouts,
    members: actions.pastDueMembers,
  };
}

export const loadMemberNotificationChrome = cache(
  async (
    userId: string,
    platformMember: boolean,
  ): Promise<MemberNotificationChrome> => {
    if (!userId) {
      return chromeFromMemberActions(EMPTY_MEMBER_ACTIONS, 0);
    }
    const [unread, gates] = await Promise.all([
      countUnreadUserNotifications(userId),
      loadAlertGates(),
    ]);
    if (!platformMember) {
      return chromeFromMemberActions({ ...EMPTY_MEMBER_ACTIONS }, unread);
    }
    const [billing, books, open, accounts, binds, copyInvite] =
      await Promise.all([
        getMemberBilling(userId),
        walletBookBalances(userId),
        listOpenInvoices("wallet", [userId]),
        listTradingAccounts(userId),
        listConnectionDeskBinds(userId),
        countInboundCopyInvites(userId),
      ]);
    const pastDue = billing?.subscriptionStatus === "past_due" ? 1 : 0;
    const collectible = open.find((invoice) =>
      openInvoiceIsCollectible(invoice),
    );
    const short =
      collectible &&
      accountShortfallUsd(collectible.amountUsd, books.main) >= 0.01
        ? 1
        : 0;
    const desk = deskActionCountsFromAttention({ accounts, binds });
    const liveIds = accounts
      .filter((account) => account.mode === "live")
      .map((account) => account.id);
    const deskCritical = await countMemberDeskCritical(userId, liveIds);
    return chromeFromMemberActions(
      applyMemberBadgeGates(
        {
          pastDue,
          accountShortfall: short,
          unboundLive: desk.unboundLive,
          sharedKey: desk.sharedKey,
          deskCritical,
          copyInvite,
          updateCard: 0,
        },
        gates.disabledBadges,
        gates.demoBadgeCounts,
      ),
      unread,
    );
  },
);

export const loadAdminNotificationChrome = cache(
  async (): Promise<AdminNotificationChrome> => {
    const [
      affiliatePayouts,
      walletWithdraws,
      pastDueMembers,
      sweepFailed,
      gasLow,
      deskCritical,
      gates,
    ] = await Promise.all([
      countQueuedPayouts("affiliate"),
      countQueuedPayouts("main"),
      countPastDueMembers(),
      countSweepFailed(),
      countGasLow(),
      countAdminDeskCritical(),
      loadAlertGates(),
    ]);
    return chromeFromAdminActions(
      applyAdminBadgeGates(
        {
          affiliatePayouts,
          walletWithdraws,
          sweepFailed,
          gasLow,
          pastDueMembers,
          deskCritical,
        },
        gates.disabledBadges,
        gates.demoBadgeCounts,
      ),
    );
  },
);

async function countQueuedPayouts(book: "affiliate" | "main"): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  const { count, error } = await supabase
    .from("membership_payouts")
    .select("id", { count: "exact", head: true })
    .eq("book", book)
    .in("status", ["requested", "approved"]);
  if (error) {
    return 0;
  }
  return count ?? 0;
}

async function countPastDueMembers(): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  const { count, error } = await supabase
    .from("members")
    .select("user_id", { count: "exact", head: true })
    .eq("subscription_status", "past_due");
  if (error) {
    return 0;
  }
  return count ?? 0;
}

async function countInboundCopyInvites(userId: string): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  const { count, error } = await supabase
    .from("desk_copy_shares")
    .select("id", { count: "exact", head: true })
    .eq("to_user_id", userId)
    .eq("status", "invited");
  if (error) {
    return 0;
  }
  return count ?? 0;
}
