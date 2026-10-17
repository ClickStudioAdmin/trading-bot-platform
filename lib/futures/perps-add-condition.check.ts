import assert from "node:assert/strict";
import {
  appendPerpsAddCondition,
  appendPerpsAddOrderGroup,
  blankPerpsAddConditionDraft,
  blankPerpsAddOrderGroups,
  blankPerpsAddOrderValues,
  countPerpsAddConditions,
  perpsAddConditionDraftForType,
  groupShowsPositionSizing,
  perpsAddGroupsSizingMissing,
  perpsOrderValuesMissing,
  revealGroupOrder,
  sharesGroupLeadSizing,
} from "./perps-add-condition";
import { entryExtraOrdersMissing } from "@/components/entry-group-order";

const blank = blankPerpsAddConditionDraft("long");
assert.equal(blank.kind, "");
assert.equal(blank.triggerCompare, "gte");
assert.equal(blankPerpsAddConditionDraft("short").triggerCompare, "lte");

const indicator = perpsAddConditionDraftForType("indicator", "long", {
  ...blank,
  kind: "supertrend",
});
assert.equal(indicator.kind, "");

const trend = perpsAddConditionDraftForType("trend", "short", blank);
assert.equal(trend.kind, "supertrend");
assert.equal(trend.compare, "cross_lte");
assert.equal(trend.period, "10");
assert.equal(trend.multiplier, "3");

const price = perpsAddConditionDraftForType("price", "long", trend);
assert.equal(price.triggerBy, "last");
assert.equal(perpsAddConditionDraftForType("webhook", "long", blank).webhookId, "");

const groups = blankPerpsAddOrderGroups("long");
assert.equal(groups.length, 1);
assert.equal(groups[0]?.lead.type, "");
assert.equal(groups[0]?.conditions.length, 0);
assert.equal(groups[0]?.order.sizeUnit, "usdt");
assert.equal(groups[0]?.order.orderType, "market");
assert.equal(groups[0]?.order.size, "");
assert.equal(countPerpsAddConditions(groups), 1);

const withCondition = groups.map((group, index) =>
  index === 0 ? appendPerpsAddCondition(group, "long") : group,
);
assert.equal(withCondition[0]?.conditions.length, 1);
assert.equal(withCondition[0]?.conditions[0]?.type, "");
assert.equal(withCondition[0]?.order.size, "");
assert.equal(countPerpsAddConditions(withCondition), 2);

const sized = withCondition.map((group, index) =>
  index === 0 ? { ...group, order: { ...group.order, size: "25" } } : group,
);
const twoGroups = appendPerpsAddOrderGroup(sized, "short");
assert.equal(twoGroups.length, 2);
assert.equal(twoGroups[0]?.order.size, "25");
assert.equal(twoGroups[1]?.order.size, "");
assert.equal(twoGroups[1]?.order.sizeUnit, "usdt");
assert.equal(twoGroups[1]?.lead.type, "");
assert.equal(twoGroups[1]?.lead.draft.triggerCompare, "lte");
assert.equal(countPerpsAddConditions(twoGroups), 3);
assert.equal(sharesGroupLeadSizing(0, undefined), false);
assert.equal(sharesGroupLeadSizing(1, undefined), true);
assert.equal(sharesGroupLeadSizing(2, true), true);
assert.equal(sharesGroupLeadSizing(2, false), false);
assert.equal(groupShowsPositionSizing(0, false, []), false);
assert.equal(groupShowsPositionSizing(0, true, []), true);
assert.equal(
  groupShowsPositionSizing(0, true, [{ join: "and", kind: "unset" }]),
  true,
);
assert.equal(
  groupShowsPositionSizing(1, true, [{ join: "or", kind: "unset" }]),
  false,
);
assert.equal(
  groupShowsPositionSizing(1, false, [{ join: "or", kind: "price" }]),
  true,
);
assert.equal(
  groupShowsPositionSizing(1, true, [
    { join: "and", kind: "indicator" },
    { join: "or", kind: "" },
  ]),
  false,
);

const leadOrder = { ...blankPerpsAddOrderValues(), size: "10" };
const revealed = revealGroupOrder(blankPerpsAddOrderValues(), leadOrder);
assert.equal(revealed.size, "10");
assert.equal(revealed.sizeUnit, "usdt");
const kept = revealGroupOrder(
  { ...blankPerpsAddOrderValues(), size: "4" },
  leadOrder,
);
assert.equal(kept.size, "4");
assert.equal(twoGroups[1]?.sameAsGroup1, undefined);

const emptyOrder = blankPerpsAddOrderValues();
assert.equal(perpsOrderValuesMissing(emptyOrder), true);
assert.equal(
  perpsOrderValuesMissing({ ...emptyOrder, size: "10" }),
  false,
);
assert.equal(
  perpsOrderValuesMissing({ ...emptyOrder, size: "0" }),
  true,
);
assert.equal(
  perpsOrderValuesMissing({
    ...emptyOrder,
    size: "10",
    orderType: "limit",
    limitPrice: "",
  }),
  true,
);
assert.equal(
  perpsOrderValuesMissing({
    ...emptyOrder,
    size: "10",
    orderType: "limit",
    limitPrice: "5",
  }),
  false,
);

const hiddenAdd = blankPerpsAddOrderGroups("long");
assert.equal(perpsAddGroupsSizingMissing(hiddenAdd), false);
const openAdd = hiddenAdd.map((group) => ({
  ...group,
  lead: { ...group.lead, type: "price" as const },
}));
assert.equal(perpsAddGroupsSizingMissing(openAdd), true);
const filledAdd = openAdd.map((group) => ({
  ...group,
  order: { ...group.order, size: "8" },
}));
assert.equal(perpsAddGroupsSizingMissing(filledAdd), false);
const limitAdd = filledAdd.map((group) => ({
  ...group,
  order: { ...group.order, orderType: "limit" as const, limitPrice: "" },
}));
assert.equal(perpsAddGroupsSizingMissing(limitAdd), true);
const sharedSecond = [
  ...filledAdd,
  {
    ...blankPerpsAddOrderGroups("short")[0]!,
    lead: {
      ...blankPerpsAddOrderGroups("short")[0]!.lead,
      type: "indicator" as const,
    },
  },
];
assert.equal(perpsAddGroupsSizingMissing(sharedSecond), false);
const ownSecond = sharedSecond.map((group, index) =>
  index === 1 ? { ...group, sameAsGroup1: false } : group,
);
assert.equal(perpsAddGroupsSizingMissing(ownSecond), true);
const hiddenSecond = sharedSecond.map((group, index) =>
  index === 1 ? { ...group, sameAsGroup1: false, lead: { ...group.lead, type: "" as const } } : group,
);
assert.equal(perpsAddGroupsSizingMissing(hiddenSecond), false);

const orRow = [{ key: "g2", join: "or" as const, draft: { kind: "price" } }];
assert.equal(entryExtraOrdersMissing(true, orRow, {}, {}), false);
assert.equal(
  entryExtraOrdersMissing(true, orRow, {}, { g2: false }),
  true,
);
assert.equal(
  entryExtraOrdersMissing(
    false,
    orRow,
    { g2: { ...emptyOrder, size: "3" } },
    { g2: false },
  ),
  false,
);
assert.equal(
  entryExtraOrdersMissing(
    true,
    [{ key: "g2", join: "or", draft: { kind: "unset" } }],
    {},
    { g2: false },
  ),
  false,
);

console.log("perps add condition checks passed");
