import { inboxBody, inboxTitle, notificationCopy } from "./copy";
import { insertUserNotification } from "./store";

type SeedRow = {
  template: string;
  notice: ReturnType<typeof notificationCopy.invoice_issued>;
  read?: boolean;
};

export function sampleInboxNotices(): SeedRow[] {
  return [
    {
      template: "invoice_issued",
      notice: notificationCopy.invoice_issued({
        planName: "Plus",
        amount: "$49.00",
        dueAt: "18 Sep 2026",
      }),
    },
    {
      template: "invoice_paid",
      notice: notificationCopy.invoice_paid({
        planName: "Plus",
        amount: "$49.00",
        periodEnd: "16 Oct 2026",
      }),
      read: true,
    },
    {
      template: "payment_failed",
      notice: notificationCopy.payment_failed({
        planName: "Plus",
        amount: "$49.00",
        reason: "Card was declined.",
      }),
    },
    {
      template: "subscription_past_due",
      notice: notificationCopy.subscription_past_due({ planName: "Plus" }),
    },
    {
      template: "deposit_credited",
      notice: notificationCopy.deposit_credited({
        amount: "$120.00",
        token: "USDT",
      }),
      read: true,
    },
    {
      template: "account_shortfall",
      notice: notificationCopy.account_shortfall({
        planName: "Plus",
        amount: "$49.00",
        mainUsd: "$12.00",
        shortUsd: "$37.00",
      }),
    },
    {
      template: "commission_released",
      notice: notificationCopy.commission_released({ amount: "$18.50" }),
      read: true,
    },
    {
      template: "payout_requested",
      notice: notificationCopy.payout_requested({
        amount: "$80.00",
        addressShort: "0x12a…9f3",
        network: "Arbitrum Sepolia",
        href: "/affiliates?tab=payouts",
      }),
    },
    {
      template: "payout_paid",
      notice: notificationCopy.payout_paid({
        amount: "$80.00",
        addressShort: "0x12a…9f3",
        network: "Arbitrum Sepolia",
        href: "/affiliates?tab=payouts",
      }),
      read: true,
    },
    {
      template: "payout_rejected",
      notice: notificationCopy.payout_rejected({
        amount: "$25.00",
        bookLabel: "Affiliate book",
        optionalNote: " Address checksum failed.",
        href: "/affiliates?tab=payouts",
      }),
    },
    {
      template: "copy_invite_received",
      notice: notificationCopy.copy_invite_received({
        deskName: "Bybit Live 1",
        traderAlias: "Northwind",
      }),
    },
    {
      template: "copy_invite_revoked",
      notice: notificationCopy.copy_invite_revoked({
        deskName: "Hyper Live",
      }),
      read: true,
    },
    {
      template: "desk_sync_failed",
      notice: notificationCopy.desk_sync_failed({
        deskName: "Bybit Liveable",
        venue: "Bybit",
        detail: "retCode 10016: Order quantity is invalid.",
        href: "/strategies/futures/activity",
      }),
    },
    {
      template: "desk_order_failed",
      notice: notificationCopy.desk_order_failed({
        deskName: "Hyper Live",
        venue: "Hyperliquid",
        detail: "Reduce only order would increase position",
        href: "/strategies/futures/positions",
      }),
    },
    {
      template: "exchange_verify_failed",
      notice: notificationCopy.exchange_verify_failed({
        connectionName: "Bybit demo",
        venue: "Bybit",
      }),
    },
    {
      template: "password_changed",
      notice: notificationCopy.password_changed(),
      read: true,
    },
    {
      template: "invoice_issued",
      notice: notificationCopy.invoice_issued({
        planName: "Pro",
        amount: "$129.00",
        dueAt: "20 Sep 2026",
      }),
    },
    {
      template: "deposit_credited",
      notice: notificationCopy.deposit_credited({
        amount: "$40.00",
        token: "USDT",
      }),
    },
    {
      template: "copy_invite_received",
      notice: notificationCopy.copy_invite_received({
        deskName: "DCA Paper",
        traderAlias: "Click",
      }),
    },
    {
      template: "desk_sync_failed",
      notice: notificationCopy.desk_sync_failed({
        deskName: "Bybit Paper 1",
        venue: "Bybit",
        detail: "Could not rest the next DCA rung.",
        href: "/strategies/futures/activity",
      }),
      read: true,
    },
  ];
}

export async function seedUserInbox(userId: string): Promise<number> {
  const supabase = (await import("@/lib/supabase/admin")).createServiceClient();
  if (!supabase || !userId) {
    return 0;
  }
  let inserted = 0;
  for (const row of sampleInboxNotices()) {
    const id = await insertUserNotification({
      userId,
      template: row.template,
      title: inboxTitle(row.notice),
      body: inboxBody(row.notice),
      href: row.notice.actionUrl,
    });
    if (id == null) {
      continue;
    }
    inserted += 1;
    if (row.read) {
      await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
    }
  }
  return inserted;
}
