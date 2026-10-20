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
  perpsAddGroupsExpr,
  perpsAddGroupsFieldIssue,
  perpsAddGroupsFromStack,
  perpsAddGroupsSizingMissing,
  perpsAddOrderSettingRows,
  perpsOrderValuesMissing,
  revealGroupOrder,
  sharesGroupLeadSizing,
  type PerpsAddOrderGroup,
} from "./perps-add-condition";
import { entryExtraOrdersMissing } from "@/components/entry-group-order";
import { conditionColumns, conditionsFromRow } from "./conditions";
import { entryStackFromJson } from "@/lib/strategy/expr";

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
assert.equal(perpsAddGroupsFieldIssue(hiddenAdd), null);
const retraceAdd = hiddenAdd.map((group) => ({
  ...group,
  lead: {
    ...group.lead,
    type: "retrace" as const,
    draft: { ...group.lead.draft, retracePct: "" },
  },
}));
assert.equal(
  perpsAddGroupsFieldIssue(retraceAdd),
  "Enter an additional-order retrace %.",
);
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

function retraceGroup(
  side: "long" | "short",
  order: PerpsAddOrderGroup["order"],
  extra?: Partial<PerpsAddOrderGroup>,
): PerpsAddOrderGroup {
  const base = blankPerpsAddOrderGroups(side)[0]!;
  return {
    ...base,
    ...extra,
    lead: {
      ...base.lead,
      type: "retrace",
      draft: {
        ...base.lead.draft,
        triggerBy: "last",
        retraceFrom: side === "short" ? "low" : "high",
        retracePct: "2",
        retraceLookback: "20",
        timeframe: "15",
      },
    },
    order,
  };
}

const sizedLong = retraceGroup("long", {
  size: "1,500",
  sizeUnit: "usdt",
  orderType: "market",
  limitPrice: "9",
});
const andPrice = appendPerpsAddCondition(sizedLong, "long");
andPrice.conditions[0] = {
  ...andPrice.conditions[0]!,
  type: "price",
  draft: {
    ...andPrice.conditions[0]!.draft,
    triggerBy: "mark",
    triggerCompare: "gte",
    triggerPrice: "3",
  },
};
const ownSizedSecond = retraceGroup(
  "long",
  { size: "2", sizeUnit: "qty", orderType: "limit", limitPrice: "1.25" },
  { sameAsGroup1: false },
);
const savedExpr = perpsAddGroupsExpr([andPrice, ownSizedSecond]);
const savedStack = entryStackFromJson(JSON.parse(savedExpr));
assert.equal(savedStack?.leaves.length, 3);
assert.equal(savedStack?.orders?.length, 2);
assert.equal(savedStack?.orders?.[0]?.size, "1500");
assert.equal(savedStack?.orders?.[0]?.limitPrice, "");
assert.equal(savedStack?.orders?.[0]?.sameAsGroup1, undefined);
assert.equal(savedStack?.orders?.[1]?.sameAsGroup1, false);
assert.equal(savedStack?.orders?.[1]?.sizeUnit, "qty");
assert.equal(savedStack?.orders?.[1]?.orderType, "limit");
assert.equal(savedStack?.orders?.[1]?.limitPrice, "1.25");

const restored = perpsAddGroupsFromStack(savedStack, "long");
assert.equal(restored.length, 2);
assert.equal(restored[0]?.conditions.length, 1);
assert.equal(restored[0]?.order.size, "1500");
assert.equal(restored[0]?.order.sizeUnit, "usdt");
assert.equal(restored[0]?.order.orderType, "market");
assert.equal(restored[0]?.order.limitPrice, "");
assert.equal(restored[1]?.sameAsGroup1, false);
assert.equal(restored[1]?.order.size, "2");
assert.equal(restored[1]?.order.sizeUnit, "qty");
assert.equal(restored[1]?.order.orderType, "limit");
assert.equal(restored[1]?.order.limitPrice, "1.25");

const sharedSizedSecond = retraceGroup("long", blankPerpsAddOrderValues(), {
  sameAsGroup1: true,
});
const sharedStack = entryStackFromJson(
  JSON.parse(perpsAddGroupsExpr([sizedLong, sharedSizedSecond])),
);
const sharedRestored = perpsAddGroupsFromStack(sharedStack, "long");
assert.equal(sharedRestored[0]?.order.size, "1500");
assert.equal(sharedRestored[1]?.sameAsGroup1, true);
assert.equal(sharedRestored[1]?.order.size, "");

const legacy = perpsAddGroupsFromStack(
  savedStack ? { leaves: savedStack.leaves, joins: savedStack.joins } : null,
  "long",
);
assert.equal(legacy[0]?.order.size, "");
assert.equal(legacy[1]?.sameAsGroup1, true);

const storedRow = conditionColumns({
  entryStack: { leaves: [], joins: [] },
  addStack: savedStack,
});
const loaded = conditionsFromRow(storedRow);
assert.equal(loaded.addStack?.orders?.[0]?.size, "1500");
assert.equal(loaded.addStack?.orders?.[1]?.limitPrice, "1.25");
const reopened = perpsAddGroupsFromStack(loaded.addStack, "long");
assert.equal(reopened[0]?.order.size, "1500");
assert.equal(reopened[1]?.order.orderType, "limit");
assert.equal(reopened[1]?.sameAsGroup1, false);

const settingRows = perpsAddOrderSettingRows(loaded.addStack);
assert.equal(settingRows.find((row) => row.label === "Group 1 size")?.value, "1500 USDT");
assert.equal(settingRows.find((row) => row.label === "Group 2 order")?.value, "Limit");
assert.equal(
  settingRows.find((row) => row.label === "Group 2 limit price")?.value,
  "1.25",
);
assert.equal(
  perpsAddOrderSettingRows(null).find((row) => row.label === "Size")?.value,
  null,
);

console.log("perps add condition checks passed");
