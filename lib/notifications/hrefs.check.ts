import assert from "node:assert/strict";
import {
  activityPathForDeskType,
  deskNameFromNoticeTitle,
  resolveInboxHref,
  safeNoticeHref,
} from "./hrefs";

assert.equal(safeNoticeHref("/account/billing"), "/account/billing");
assert.equal(safeNoticeHref("https://evil.example"), "/account/notifications");
assert.equal(safeNoticeHref("//evil.example"), "/account/notifications");
assert.equal(deskNameFromNoticeTitle("Desk sync failed — Bybit Live 2"), "Bybit Live 2");
assert.equal(activityPathForDeskType("dca"), "/strategies/futures/activity");
assert.equal(
  activityPathForDeskType("cash_and_carry"),
  "/strategies/cash-and-carry/activity",
);

const desks = [
  { id: "cc-1", name: "Carry", deskType: "cash_and_carry" },
  { id: "tv-2", name: "Bybit Live 2", deskType: "signal_follower" },
];

assert.equal(
  resolveInboxHref({
    href: "/strategies/futures/activity",
    title: "Desk sync failed — Bybit Live 2",
    template: "desk_sync_failed",
    desks,
  }),
  "/strategies/futures/activity?desk=tv-2",
);
assert.equal(
  resolveInboxHref({
    href: "/strategies/futures/positions",
    title: "Live order failed — Bybit Live 2",
    template: "desk_order_failed",
    desks,
  }),
  "/strategies/futures/activity?desk=tv-2",
);
assert.equal(
  resolveInboxHref({
    href: "/account/billing?tab=invoices",
    title: "Invoice ready — Pro $129.00",
    template: "invoice_issued",
    desks,
  }),
  "/account/billing?tab=invoices",
);
assert.equal(
  resolveInboxHref({
    href: "/strategies/futures/activity?desk=tv-2",
    title: "Desk sync failed — Bybit Live 2",
    template: "desk_sync_failed",
    desks,
  }),
  "/strategies/futures/activity?desk=tv-2",
);

console.log("notification href checks passed");
