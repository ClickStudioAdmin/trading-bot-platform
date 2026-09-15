export type NotificationNotice = {
  subject: string;
  paragraphs: string[];
  actionLabel: string;
  actionUrl: string;
};

function notice(
  subject: string,
  paragraphs: string[],
  action: { label: string; url: string },
): NotificationNotice {
  return {
    subject,
    paragraphs,
    actionLabel: action.label,
    actionUrl: action.url,
  };
}

export const notificationCopy = {
  invoice_issued: (input: {
    planName: string;
    amount: string;
    dueAt: string;
  }) =>
    notice(
      `Invoice ready — ${input.planName} ${input.amount}`,
      [
        `Your ${input.planName} renewal invoice for ${input.amount} is open. Payment is due ${input.dueAt}.`,
        "If you pay with Crypto, we collect from Account Balance in the hours before the due time.",
      ],
      { label: "View invoice", url: "/account/billing?tab=invoices" },
    ),
  invoice_paid: (input: {
    planName: string;
    amount: string;
    periodEnd: string;
  }) =>
    notice(
      `Payment received — ${input.planName} ${input.amount}`,
      [
        `We recorded ${input.amount} for ${input.planName}. Your next period ends ${input.periodEnd}.`,
      ],
      { label: "View invoice", url: "/account/billing?tab=invoices" },
    ),
  payment_failed: (input: {
    planName: string;
    amount: string;
    reason: string;
  }) =>
    notice(
      `Payment failed — ${input.planName}`,
      [
        `We could not collect ${input.amount} for ${input.planName}. ${input.reason}`,
        "Update your card or top up Account Balance, then we will retry.",
      ],
      { label: "Open billing", url: "/account/billing" },
    ),
  subscription_past_due: (input: { planName: string }) =>
    notice(
      "Your subscription is past due",
      [
        `Your ${input.planName} payment is overdue. Withdraws stay locked until this is paid.`,
        "Open Billing to pay or change method.",
      ],
      { label: "Open billing", url: "/account/billing" },
    ),
  deposit_credited: (input: { amount: string; token: string }) =>
    notice(
      `Account Balance credited — ${input.amount}`,
      [
        `${input.amount} was credited to Account Balance from your ${input.token} deposit.`,
      ],
      { label: "View Account Balance", url: "/account/billing?tab=wallet" },
    ),
  account_shortfall: (input: {
    planName: string;
    amount: string;
    mainUsd: string;
    shortUsd: string;
  }) =>
    notice(
      "Account Balance is short for your next payment",
      [
        `Your next ${input.planName} payment is ${input.amount}. Account Balance is ${input.mainUsd} (short ${input.shortUsd}).`,
        "Top up before we collect or the invoice will stay unpaid.",
      ],
      { label: "Top up", url: "/account/billing?tab=wallet" },
    ),
  commission_released: (input: { amount: string }) =>
    notice(
      `Commission released — ${input.amount}`,
      [
        `${input.amount} left hold and was credited to your Affiliate book. You can withdraw any amount at or above the minimum.`,
      ],
      { label: "Open Affiliates", url: "/affiliates?tab=payouts" },
    ),
  payout_requested: (input: {
    amount: string;
    addressShort: string;
    network: string;
    href: string;
  }) =>
    notice(
      `Withdraw requested — ${input.amount}`,
      [
        `We queued ${input.amount} USDT to ${input.addressShort} on ${input.network}. Click sends it from the admin wallet and marks the list paid.`,
      ],
      { label: "View payouts", url: input.href },
    ),
  payout_paid: (input: {
    amount: string;
    addressShort: string;
    network: string;
    href: string;
  }) =>
    notice(
      `Withdraw paid — ${input.amount}`,
      [
        `${input.amount} USDT was marked paid to ${input.addressShort} on ${input.network}.`,
      ],
      { label: "View payouts", url: input.href },
    ),
  payout_rejected: (input: {
    amount: string;
    bookLabel: string;
    optionalNote?: string;
    href: string;
  }) =>
    notice(
      `Withdraw rejected — ${input.amount}`,
      [
        `Your ${input.amount} USDT withdraw was rejected.${input.optionalNote ?? ""}`,
        `The amount is back on your ${input.bookLabel}.`,
      ],
      { label: "View payouts", url: input.href },
    ),
  copy_invite_received: (input: { deskName: string; traderAlias: string }) =>
    notice(
      `Copy invite — ${input.deskName}`,
      [
        `${input.traderAlias} invited you to copy ${input.deskName}. Open Copy Trading to accept or ignore.`,
      ],
      { label: "Open Copy Trading", url: "/account/copy" },
    ),
  copy_invite_revoked: (input: { deskName: string }) =>
    notice(
      `Copy invite withdrawn — ${input.deskName}`,
      [`The invite to copy ${input.deskName} was withdrawn.`],
      { label: "Open Copy Trading", url: "/account/copy" },
    ),
  desk_sync_failed: (input: {
    deskName: string;
    venue: string;
    detail: string;
    href: string;
  }) =>
    notice(
      `Desk sync failed — ${input.deskName}`,
      [
        `${input.deskName} could not sync with ${input.venue}. ${input.detail}`,
        "The bot stays as it is until this is fixed. Check the desk Activity log.",
      ],
      { label: "Open desk", url: input.href },
    ),
  desk_order_failed: (input: {
    deskName: string;
    venue: string;
    detail: string;
    href: string;
  }) =>
    notice(
      `Live order failed — ${input.deskName}`,
      [
        `${input.deskName} hit a repeating ${input.venue} reject (${input.detail}).`,
        "Open the desk, fix the bind or size, or disarm the bot.",
      ],
      { label: "Open desk", url: input.href },
    ),
  exchange_verify_failed: (input: {
    connectionName: string;
    venue: string;
  }) =>
    notice(
      `Exchange key failed — ${input.connectionName}`,
      [
        `We could not verify ${input.connectionName} (${input.venue}). Live desks on this key will not place until you replace it.`,
      ],
      { label: "Open Exchanges", url: "/account/exchanges" },
    ),
  password_changed: () =>
    notice(
      "Your password was changed",
      [
        "The password for this Trading Bot Platform login was changed. If you did not do this, reset it and contact support.",
      ],
      { label: "Account settings", url: "/account/settings" },
    ),
  operator_payout_requested: (input: {
    memberLabel: string;
    amount: string;
    bookLabel: string;
    addressShort: string;
    network: string;
    href: string;
  }) =>
    notice(
      `Payout to send — ${input.bookLabel} ${input.amount}`,
      [
        `${input.memberLabel} requested ${input.amount} USDT (${input.bookLabel}) to ${input.addressShort} on ${input.network}.`,
      ],
      { label: "Open queue", url: input.href },
    ),
  operator_sweep_failed: (input: { chain: string; detail: string }) =>
    notice(
      `Sweep failed — ${input.chain}`,
      [
        `A credited deposit on ${input.chain} did not sweep (${input.detail}). The member credit stays. Retry on the next watch.`,
      ],
      { label: "Billing", url: "/admin/billing" },
    ),
  operator_gas_low: (input: {
    chain: string;
    balanceEth: string;
    thresholdEth: string;
  }) =>
    notice(
      `Gas wallet low — ${input.chain}`,
      [
        `The gas wallet on ${input.chain} is ${input.balanceEth} ETH (threshold ${input.thresholdEth}). Fund it so sweeps can pay gas.`,
      ],
      { label: "Billing", url: "/admin/billing" },
    ),
  operator_payment_failed: (input: {
    memberLabel: string;
    planName: string;
    amount: string;
    reason: string;
  }) =>
    notice(
      `Member payment failed — ${input.memberLabel}`,
      [
        `${input.memberLabel} (${input.planName}) failed to pay ${input.amount}. ${input.reason}`,
      ],
      { label: "Member", url: "/admin/members" },
    ),
  operator_desk_critical: (input: {
    memberLabel: string;
    deskName: string;
    venue: string;
    detail: string;
  }) =>
    notice(
      `Live desk issue — ${input.deskName}`,
      [
        `${input.memberLabel} desk ${input.deskName} (${input.venue}) is failing: ${input.detail}`,
      ],
      { label: "Admin logs", url: "/admin/logs?level=error" },
    ),
};

export function sampleNotice(id: string): NotificationNotice {
  switch (id) {
    case "invoice_issued":
      return notificationCopy.invoice_issued({
        planName: "Plus",
        amount: "$49.00",
        dueAt: "18 Sep 2026",
      });
    case "invoice_paid":
      return notificationCopy.invoice_paid({
        planName: "Plus",
        amount: "$49.00",
        periodEnd: "16 Oct 2026",
      });
    case "payment_failed":
      return notificationCopy.payment_failed({
        planName: "Plus",
        amount: "$49.00",
        reason: "Card was declined.",
      });
    case "subscription_past_due":
      return notificationCopy.subscription_past_due({ planName: "Plus" });
    case "deposit_credited":
      return notificationCopy.deposit_credited({
        amount: "$120.00",
        token: "USDT",
      });
    case "account_shortfall":
      return notificationCopy.account_shortfall({
        planName: "Plus",
        amount: "$49.00",
        mainUsd: "$12.00",
        shortUsd: "$37.00",
      });
    case "commission_released":
      return notificationCopy.commission_released({ amount: "$18.50" });
    case "payout_requested":
      return notificationCopy.payout_requested({
        amount: "$80.00",
        addressShort: "0x12a…9f3",
        network: "Arbitrum Sepolia",
        href: "/affiliates?tab=payouts",
      });
    case "payout_paid":
      return notificationCopy.payout_paid({
        amount: "$80.00",
        addressShort: "0x12a…9f3",
        network: "Arbitrum Sepolia",
        href: "/affiliates?tab=payouts",
      });
    case "payout_rejected":
      return notificationCopy.payout_rejected({
        amount: "$25.00",
        bookLabel: "Affiliate book",
        optionalNote: " Address checksum failed.",
        href: "/affiliates?tab=payouts",
      });
    case "copy_invite_received":
      return notificationCopy.copy_invite_received({
        deskName: "Bybit Live 1",
        traderAlias: "Northwind",
      });
    case "copy_invite_revoked":
      return notificationCopy.copy_invite_revoked({
        deskName: "Hyper Live",
      });
    case "desk_sync_failed":
      return notificationCopy.desk_sync_failed({
        deskName: "Bybit Live 2",
        venue: "Bybit",
        detail: "retCode 10016: Order quantity is invalid.",
        href: "/strategies/futures/activity",
      });
    case "desk_order_failed":
      return notificationCopy.desk_order_failed({
        deskName: "Hyper Live",
        venue: "Hyperliquid",
        detail: "Reduce only order would increase position",
        href: "/strategies/futures/positions",
      });
    case "exchange_verify_failed":
      return notificationCopy.exchange_verify_failed({
        connectionName: "Bybit demo",
        venue: "Bybit",
      });
    case "password_changed":
      return notificationCopy.password_changed();
    default:
      return sampleOperatorNotice(id);
  }
}

export function sampleOperatorNotice(id: string): NotificationNotice {
  switch (id) {
    case "operator_payout_requested":
      return notificationCopy.operator_payout_requested({
        memberLabel: "Plus member",
        amount: "$80.00",
        bookLabel: "Affiliate book",
        addressShort: "0x12a…9f3",
        network: "Arbitrum Sepolia",
        href: "/admin/affiliates",
      });
    case "operator_sweep_failed":
      return notificationCopy.operator_sweep_failed({
        chain: "Arbitrum Sepolia",
        detail: "insufficient funds for gas",
      });
    case "operator_gas_low":
      return notificationCopy.operator_gas_low({
        chain: "Arbitrum Sepolia",
        balanceEth: "0.001",
        thresholdEth: "0.005",
      });
    case "operator_payment_failed":
      return notificationCopy.operator_payment_failed({
        memberLabel: "Plus member",
        planName: "Plus",
        amount: "$49.00",
        reason: "Card was declined.",
      });
    case "operator_desk_critical":
      return notificationCopy.operator_desk_critical({
        memberLabel: "Plus member",
        deskName: "Bybit Live 1",
        venue: "Bybit",
        detail: "retCode 10016: Order quantity is invalid.",
      });
    default:
      return notificationCopy.operator_desk_critical({
        memberLabel: "Member",
        deskName: "Live desk",
        venue: "Bybit",
        detail: "Unknown operator template.",
      });
  }
}

export function inboxTitle(notice: NotificationNotice): string {
  return notice.subject;
}

export function inboxBody(notice: NotificationNotice): string {
  return notice.paragraphs[0] ?? "";
}
