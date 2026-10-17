import assert from "node:assert/strict";
import {
  countArmedRules,
  desksInPlay,
  overviewBotsHint,
  overviewBotsPath,
  overviewBoundDeskLabel,
  overviewCriticalItems,
  overviewDeskDetail,
  overviewDeskHint,
  overviewFocusHref,
  overviewKeyModeLabel,
  overviewOrdersHint,
  overviewPageAttention,
  overviewPositionsHint,
  overviewPositionsPath,
  overviewRealized30d,
  overviewStats,
  type OverviewDeskFacts,
} from "./overview";

function desk(partial: Partial<OverviewDeskFacts> & Pick<OverviewDeskFacts, "id" | "name">): OverviewDeskFacts {
  return {
    mode: "paper",
    deskType: "flex",
    venueEnvironment: null,
    copy: false,
    openCount: 0,
    carryOpenCount: 0,
    futuresOpenCount: 0,
    workingCount: 0,
    botsOn: 0,
    reduceOnly: false,
    bound: true,
    critical: false,
    ...partial,
  };
}

assert.equal(countArmedRules([]), 0);
assert.equal(countArmedRules([undefined, "active", "reduce_only", "disabled"]), 3);

const idle = desk({ id: "idle", name: "Idle" });
const critical = desk({
  id: "crit",
  name: "Zeta",
  mode: "live",
  venueEnvironment: "live",
  critical: true,
  bound: true,
});
const unbound = desk({
  id: "open-key",
  name: "Alpha",
  mode: "live",
  venueEnvironment: "live",
  bound: false,
});
const reduce = desk({ id: "reduce", name: "Reduce", reduceOnly: true });
const opened = desk({
  id: "open",
  name: "Open",
  deskType: "manual",
  openCount: 2,
  futuresOpenCount: 2,
});
const working = desk({
  id: "work",
  name: "Work",
  deskType: "manual",
  workingCount: 1,
});
const bots = desk({
  id: "bots",
  name: "Bots",
  deskType: "dca",
  botsOn: 3,
});
const carry = desk({
  id: "carry",
  name: "Carry",
  deskType: "cash_and_carry",
  openCount: 1,
  carryOpenCount: 1,
});
const copyPaper = desk({
  id: "copy",
  name: "Copy",
  copy: true,
  deskType: "dca",
});
const demo = desk({
  id: "demo",
  name: "Demo",
  mode: "live",
  venueEnvironment: "demo",
  bound: true,
});

const stats = overviewStats([
  idle,
  critical,
  unbound,
  reduce,
  opened,
  working,
  bots,
  carry,
  copyPaper,
  demo,
]);
assert.equal(stats.desks, 10);
assert.equal(stats.paper, 7);
assert.equal(stats.demo, 1);
assert.equal(stats.live, 2);
assert.equal(stats.copy, 1);
assert.equal(stats.openPositions, 3);
assert.equal(stats.carryOpen, 1);
assert.equal(stats.futuresOpen, 2);
assert.equal(stats.openOrders, 1);
assert.equal(stats.orderDesks, 1);
assert.equal(stats.botsOn, 3);
assert.equal(stats.botDesks, 1);
assert.equal(overviewDeskHint(stats), "7 Paper · 1 Demo · 2 Live · 1 Copy");
assert.equal(overviewDeskHint(overviewStats([])), "None yet");
assert.equal(overviewPositionsHint(stats), "1 Cash and Carry · 2 Perps");
assert.equal(overviewPositionsHint(overviewStats([])), "None open");
assert.equal(overviewOrdersHint(stats), "on 1 desk");
assert.equal(overviewOrdersHint(overviewStats([])), "None working");
assert.equal(overviewBotsHint(stats), "on 1 desk");
assert.equal(overviewBotsHint(overviewStats([])), "None armed");

assert.deepEqual(
  desksInPlay([
    idle,
    bots,
    working,
    opened,
    reduce,
    unbound,
    critical,
    copyPaper,
    demo,
  ]).map((row) => row.id),
  ["crit", "open-key", "reduce", "open", "work", "bots"],
);

assert.equal(overviewDeskDetail(unbound), "No key bound");
assert.equal(
  overviewDeskDetail({
    ...opened,
    workingCount: 1,
    botsOn: 1,
    reduceOnly: true,
    critical: true,
  }),
  "2 Open positions - 1 Open order - Bots on - Reduce only - Critical issue",
);

assert.equal(
  overviewPositionsPath(carry),
  "/strategies/cash-and-carry/positions?desk=carry",
);
assert.equal(
  overviewPositionsPath(opened),
  "/strategies/futures/positions?desk=open",
);
assert.equal(
  overviewBotsPath(bots),
  "/strategies/futures/automations?desk=bots",
);
assert.equal(
  overviewBotsPath(carry),
  "/strategies/cash-and-carry/automations?desk=carry",
);
assert.equal(overviewBotsPath(copyPaper), overviewPositionsPath(copyPaper));
assert.equal(overviewFocusHref("positions", [idle]), undefined);
assert.equal(overviewFocusHref("positions", [carry]), overviewPositionsPath(carry));
assert.equal(overviewFocusHref("positions", [carry, opened]), "#desks-in-play");
assert.equal(overviewFocusHref("orders", [working]), overviewPositionsPath(working));
assert.equal(
  overviewFocusHref("bots", [bots, { ...carry, botsOn: 1 }]),
  "#desks-in-play",
);

assert.equal(overviewRealized30d("cash_and_carry", 12), null);
assert.equal(overviewRealized30d("dca", null), null);
assert.equal(overviewRealized30d("dca", 4.5), 4.5);
assert.equal(overviewRealized30d("manual", Number.NaN), null);

const criticalItems = overviewCriticalItems(
  [
    { id: "b", name: "Beta", deskType: "dca" },
    { id: "a", name: "Alpha", deskType: "cash_and_carry" },
    { id: "c", name: "Quiet", deskType: "manual" },
  ],
  ["b", "a"],
);
assert.deepEqual(
  criticalItems.map((item) => item.label),
  ["Alpha has a critical issue.", "Beta has a critical issue."],
);
assert.equal(
  criticalItems[0]?.href,
  "/strategies/cash-and-carry/activity?desk=a",
);
assert.equal(criticalItems[1]?.href, "/strategies/futures/activity?desk=b");

const attention = overviewPageAttention({
  accounts: [
    {
      id: "a",
      name: "Alpha",
      mode: "live",
      deskType: "dca",
      venue: "bybit",
    },
  ],
  binds: [],
  pastDue: true,
  accountShortfall: false,
  copyInvite: 1,
  updateCard: false,
  criticalIds: ["a"],
});
assert.deepEqual(attention, [
  {
    label: "Your subscription is past due.",
    href: "/account/billing",
  },
  {
    label: "One copy invite is waiting.",
    href: "/account/copy",
  },
  {
    label: "Alpha is a live Bybit desk with no key bound.",
    href: "/account/sub-accounts?tab=exchanges",
  },
  {
    label: "Alpha has a critical issue.",
    href: "/strategies/futures/activity?desk=a",
  },
]);
assert.equal(
  attention.some((item) => item.href === "/account"),
  false,
);

assert.equal(
  overviewBoundDeskLabel(
    "key",
    [
      { connectionId: "key", accountId: "b" },
      { connectionId: "key", accountId: "a" },
      { connectionId: "other", accountId: "c" },
    ],
    [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ],
  ),
  "Alpha, Beta",
);
assert.equal(overviewBoundDeskLabel("missing", [], []), "No desk bound");
assert.equal(overviewKeyModeLabel("demo"), "Demo");
assert.equal(overviewKeyModeLabel("testnet"), "Demo");
assert.equal(overviewKeyModeLabel("live"), "Live");
