import assert from "node:assert/strict";
import {
  adminActionTotal,
  deskActionCountsFromAttention,
  EMPTY_ADMIN_ACTIONS,
  EMPTY_MEMBER_ACTIONS,
  formatNavBadgeCount,
  headerNoticeCount,
  memberActionTotal,
  memberBillingActionTotal,
  memberOverviewAttention,
  notificationAttentionItems,
} from "./badge-model";
import {
  adminSettingGroups,
  emailSwitchLockedOn,
  memberSettingGroups,
  notificationAudience,
  NOTIFICATION_LABELS,
} from "./settings";
import { NOTIFICATION_IDS } from "./catalog";

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
assert.equal(headerNoticeCount(2, 3), 5);
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
  true,
);
assert.equal(
  memberSettingGroups(false).some((group) => group.id === "copy"),
  true,
);
assert.equal(
  adminSettingGroups().some((group) => group.id === "operator"),
  true,
);
for (const id of NOTIFICATION_IDS) {
  assert.equal(Boolean(NOTIFICATION_LABELS[id]), true);
}

console.log("notification badge checks passed");
