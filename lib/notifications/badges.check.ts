import assert from "node:assert/strict";
import {
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
import {
  ADMIN_BADGE_SETTINGS,
  AFFILIATE_BADGE_SETTINGS,
  applyAdminBadgeGates,
  applyMemberBadgeGates,
  BADGE_IDS,
  BADGE_SETTINGS,
  demoBadgesAllowed,
  gatedBadgeCount,
  MEMBER_BADGE_SETTINGS,
  SAMPLE_BADGE_COUNTS,
} from "./badges-catalog";
import {
  ADMIN_CHANNEL_LIST,
  adminSettingGroups,
  channelBadgeIds,
  channelEmailIds,
  emailSwitchLockedOn,
  MEMBER_CHANNEL_LIST,
  memberSettingGroups,
  notificationAudience,
  NOTIFICATION_LABELS,
} from "./settings";
import { NOTIFICATION_IDS, operatorNotificationIds } from "./catalog";
import { sampleInboxNotices } from "./seed";

assert.equal(formatNavBadgeCount(0), null);
assert.equal(formatNavBadgeCount(-3), null);
assert.equal(formatNavBadgeCount(1), "1");
assert.equal(formatNavBadgeCount(99), "99");
assert.equal(formatNavBadgeCount(100), "99+");

assert.equal(memberActionTotal(EMPTY_MEMBER_ACTIONS), 0);
assert.equal(
  memberActionTotal({
    ...EMPTY_MEMBER_ACTIONS,
    pastDue: 1,
    copyInvite: 2,
    unboundLive: 1,
  }),
  4,
);
assert.equal(
  memberBillingActionTotal({
    ...EMPTY_MEMBER_ACTIONS,
    pastDue: 1,
    accountShortfall: 1,
    copyInvite: 4,
  }),
  2,
);
assert.deepEqual(
  memberBillingTabCounts({
    ...EMPTY_MEMBER_ACTIONS,
    pastDue: 1,
    accountShortfall: 1,
    updateCard: 1,
  }),
  {
    overview: 1,
    invoices: 0,
    method: 1,
    wallet: 1,
    ledger: 0,
  },
);
assert.deepEqual(
  adminBillingTabCounts({
    ...EMPTY_ADMIN_ACTIONS,
    sweepFailed: 1,
    gasLow: 1,
    walletWithdraws: 2,
  }),
  { overview: 2, invoices: 0, withdrawals: 2 },
);
assert.deepEqual(
  notificationAttentionItems({
    pastDue: false,
    accountShortfall: false,
    copyInvite: 0,
    updateCard: true,
  }),
  [
    {
      label: "Update the card on this login.",
      href: "/account/billing?tab=method",
    },
  ],
);
assert.equal(adminActionTotal(EMPTY_ADMIN_ACTIONS), 0);
assert.equal(
  adminActionTotal({
    ...EMPTY_ADMIN_ACTIONS,
    affiliatePayouts: 2,
    pastDueMembers: 1,
  }),
  3,
);

assert.deepEqual(
  deskActionCountsFromAttention({
    accounts: [
      { id: "a", name: "Live A", mode: "live" },
      { id: "b", name: "Paper", mode: "paper" },
    ],
    binds: [],
  }),
  { unboundLive: 1, sharedKey: 0 },
);
assert.deepEqual(
  deskActionCountsFromAttention({
    accounts: [
      { id: "a", name: "Live A", mode: "live" },
      { id: "b", name: "Live B", mode: "live" },
    ],
    binds: [
      { connectionId: "k1", accountId: "a" },
      { connectionId: "k1", accountId: "b" },
    ],
  }),
  { unboundLive: 0, sharedKey: 1 },
);

assert.deepEqual(
  notificationAttentionItems({
    pastDue: true,
    accountShortfall: true,
    copyInvite: 2,
    updateCard: true,
    deskCritical: 1,
  }),
  [
    {
      label: "Your subscription is past due.",
      href: "/account/billing",
    },
    {
      label: "Account Balance is short for your next payment.",
      href: "/account/billing?tab=wallet",
    },
    {
      label: "One live desk has a critical issue.",
      href: "/account",
    },
    {
      label: "2 copy invites are waiting.",
      href: "/account/copy",
    },
  ],
);

const attention = memberOverviewAttention({
  accounts: [{ id: "a", name: "Live A", mode: "live", venue: "bybit" }],
  binds: [],
  pastDue: true,
  accountShortfall: false,
  copyInvite: 0,
  updateCard: false,
});
assert.equal(attention[0]?.href, "/account/billing");
assert.equal(attention.some((item) => item.href === "/account/exchanges"), true);

assert.equal(emailSwitchLockedOn("password_changed"), true);
assert.equal(emailSwitchLockedOn("invoice_issued"), false);
assert.equal(notificationAudience("operator_gas_low"), "operator");
assert.equal(notificationAudience("invoice_paid"), "member");
assert.equal(
  memberSettingGroups(true).some((group) => group.id === "desk"),
  false,
);
assert.equal(
  memberSettingGroups(true).some((group) => group.id === "billing"),
  false,
);
assert.equal(
  memberSettingGroups(true).some((group) => group.id === "security"),
  true,
);
assert.equal(
  memberSettingGroups(true)
    .find((group) => group.id === "affiliates")
    ?.ids.includes("commission_released"),
  true,
);
assert.equal(
  memberSettingGroups(false).some((group) => group.id === "copy"),
  true,
);
assert.equal(
  memberSettingGroups(true).some((group) => group.id === "affiliates"),
  true,
);
assert.equal(
  memberSettingGroups(true).some((group) => group.id === "payouts"),
  false,
);
assert.equal(
  adminSettingGroups().some((group) => group.id === "admin"),
  true,
);
assert.equal(adminSettingGroups()[0]?.id, "admin");
const adminEmails = adminSettingGroups().find((group) => group.id === "admin");
assert.deepEqual(adminEmails?.ids, operatorNotificationIds());
const adminAffiliates = adminSettingGroups().find(
  (group) => group.id === "affiliates",
);
assert.equal(adminAffiliates?.ids.includes("commission_released"), true);
assert.equal(
  adminAffiliates?.ids.includes("operator_payout_requested"),
  false,
);
for (const id of NOTIFICATION_IDS) {
  assert.equal(Boolean(NOTIFICATION_LABELS[id]), true);
}

const emails = channelEmailIds();
assert.equal(new Set(emails).size, emails.length);
assert.deepEqual([...emails].sort(), [...NOTIFICATION_IDS].sort());
const badges = channelBadgeIds();
assert.equal(new Set(badges).size, badges.length);
assert.deepEqual([...badges].sort(), [...BADGE_IDS].sort());
assert.equal(MEMBER_CHANNEL_LIST.showInApp, true);
assert.equal(ADMIN_CHANNEL_LIST.showInApp, false);
const memberRows = MEMBER_CHANNEL_LIST.groups.flatMap((group) => group.rows);
const adminRows = ADMIN_CHANNEL_LIST.groups.flatMap((group) => group.rows);
const pastDue = memberRows.find((row) => row.id === "subscription_past_due");
assert.equal(pastDue?.emailId, "subscription_past_due");
assert.equal(pastDue?.badgeId, "past_due");
const copyInvite = memberRows.find((row) => row.id === "copy_invite_received");
assert.equal(copyInvite?.badgeId, "copy_invite");
const deskCritical = memberRows.find((row) => row.id === "desk_sync_failed");
assert.equal(deskCritical?.badgeId, "desk_critical");
assert.equal(
  memberRows.some((row) => row.emailId?.startsWith("operator_")),
  false,
);
assert.equal(
  adminRows.every((row) => !row.emailId || row.emailId.startsWith("operator_")),
  true,
);
const payout = adminRows.find((row) => row.id === "operator_payout_requested");
assert.equal(payout?.badgeId, "affiliate_payouts");
assert.equal(
  adminRows.find((row) => row.id === "wallet_withdraws")?.emailId,
  undefined,
);

assert.equal(demoBadgesAllowed({ VERCEL_ENV: "production" }), false);
assert.equal(demoBadgesAllowed({ VERCEL_ENV: "preview" }), true);
assert.equal(gatedBadgeCount(3, true, 9), 0);
assert.equal(gatedBadgeCount(0, false, 4), 4);
assert.equal(gatedBadgeCount(2, false, 1), 2);
assert.equal(BADGE_SETTINGS.length, BADGE_IDS.length);
assert.equal(
  MEMBER_BADGE_SETTINGS.length +
    AFFILIATE_BADGE_SETTINGS.length +
    ADMIN_BADGE_SETTINGS.length,
  BADGE_IDS.length,
);
assert.equal(
  AFFILIATE_BADGE_SETTINGS.some((row) => row.id === "affiliate_payouts"),
  true,
);
for (const id of BADGE_IDS) {
  assert.equal(SAMPLE_BADGE_COUNTS[id] > 0, true);
}

assert.equal(
  applyMemberBadgeGates(
    { ...EMPTY_MEMBER_ACTIONS, pastDue: 1, copyInvite: 2 },
    ["copy_invite"],
    { past_due: 1, copy_invite: 9 },
    true,
  ).copyInvite,
  0,
);
assert.equal(
  applyMemberBadgeGates(EMPTY_MEMBER_ACTIONS, [], SAMPLE_BADGE_COUNTS, true)
    .copyInvite,
  SAMPLE_BADGE_COUNTS.copy_invite,
);
assert.equal(
  applyMemberBadgeGates(EMPTY_MEMBER_ACTIONS, [], SAMPLE_BADGE_COUNTS, false)
    .copyInvite,
  0,
);
assert.equal(
  applyAdminBadgeGates(
    { ...EMPTY_ADMIN_ACTIONS, affiliatePayouts: 1 },
    ["affiliate_payouts"],
    SAMPLE_BADGE_COUNTS,
    true,
  ).affiliatePayouts,
  0,
);
assert.equal(
  applyAdminBadgeGates(EMPTY_ADMIN_ACTIONS, [], SAMPLE_BADGE_COUNTS, true)
    .deskCritical,
  SAMPLE_BADGE_COUNTS.admin_desk_critical,
);

const samples = sampleInboxNotices();
assert.equal(samples.length >= 16, true);
assert.equal(samples.some((row) => row.read), true);
assert.equal(samples.some((row) => !row.read), true);

console.log("notification badge checks passed");
