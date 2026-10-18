import assert from "node:assert/strict";
import {
  classicExitClause,
  customExitClause,
  emptyExitClause,
  emptyRepeatLevels,
  trailActivationKind,
} from "./exit-clauses";
import {
  clausesFromExitActions,
  emptyExitRuntime,
  exitActionGate,
  exitActionsForSave,
  exitActionsFromJson,
  exitCardsBlockReason,
  exitSideUsesColumns,
  planExitClaims,
  savedTrailActivation,
  trailFitsColumns,
  trailingGateError,
  type ExitSidePrices,
  type StoredExitAction,
} from "./exit-actions";

const prices: ExitSidePrices = {
  takeProfitPct: 10,
  takeProfitPrice: null,
  stopLossPct: 5,
  stopLossPrice: null,
  trailingDistance: 2,
  trailingActivation: null,
};

const classic = [
  classicExitClause("take_profit"),
  classicExitClause("stop_loss"),
  customExitClause({ trigger: "indicator", spec: null }),
];
assert.equal(exitSideUsesColumns(classic), true);
assert.equal(exitActionsForSave(classic, prices), null);
assert.equal(exitCardsBlockReason([emptyExitClause()]), null);

const trendDraft = {
  trigger: "trend" as const,
  spec: {
    kind: "supertrend" as const,
    timeframe: "15" as const,
    compare: "cross_gte" as const,
    level: null,
    levelTo: null,
    period: 10,
    slowPeriod: null,
    multiplier: 3,
  },
};
const armed = classicExitClause("trailing_stop");
armed.rows = [{ key: "trend", join: "and", draft: trendDraft }];
assert.equal(exitSideUsesColumns([armed]), false);
const saved = exitActionsForSave([armed], prices);
assert.equal(saved?.length, 1);
assert.equal(saved?.[0]?.kind, "trailing_stop");
assert.equal(saved?.[0]?.groups.length, 1);
assert.equal(saved?.[0]?.groups[0]?.anchor.trigger, "trail");
assert.equal(saved?.[0]?.groups[0]?.rows[0]?.trigger, "trend");
assert.equal(saved?.[0]?.trailingDistance, 2);
assert.equal(exitCardsBlockReason([armed]), null);

const half = classicExitClause("take_profit");
half.scope = { kind: "percent", pct: 50 };
const rest = classicExitClause("trailing_stop");
rest.key = "trail-rest";
rest.scope = { kind: "remainder" };
rest.rows = [
  {
    key: "rsi",
    join: "and",
    draft: {
      trigger: "indicator",
      spec: {
        kind: "rsi",
        timeframe: "60",
        compare: "cross_gte",
        level: 70,
        levelTo: null,
        period: 14,
        slowPeriod: null,
        multiplier: null,
      },
    },
  },
];
assert.equal(exitActionsForSave([half, rest], prices)?.[1]?.scope.kind, "remainder");
assert.equal(exitActionsForSave([half, rest], prices)?.[1]?.trailingDistance, 2);
assert.equal(exitCardsBlockReason([half, rest]), null);
const indicatorOnly = classicExitClause("take_profit");
indicatorOnly.anchor = { trigger: "webhook", webhookId: "arm" };
assert.match(exitCardsBlockReason([indicatorOnly]) ?? "", /Target Hit/);

const missingScope = classicExitClause("take_profit");
missingScope.scope = { kind: "percent", pct: null };
assert.match(
  exitCardsBlockReason([missingScope]) ?? "",
  /percent/i,
);

const lots = [
  { id: "a", qty: 1, price: 100 },
  { id: "b", qty: 1, price: 130 },
];

const harvest: StoredExitAction[] = [
  {
    id: "harvest",
    kind: "close",
    scope: { kind: "fills", minProfitPct: 20 },
    groups: [],
    takeProfitPct: null,
    takeProfitPrice: null,
    stopLossPct: null,
    stopLossPrice: null,
    trailingDistance: null,
    trailingActivation: null,
  },
  {
    id: "stop",
    kind: "stop_loss",
    scope: { kind: "remainder" },
    groups: [],
    takeProfitPct: null,
    takeProfitPrice: null,
    stopLossPct: 5,
    stopLossPrice: null,
    trailingDistance: null,
    trailingActivation: null,
  },
];

const firstHarvest = planExitClaims({
  actions: harvest,
  runtime: emptyExitRuntime(),
  lots,
  side: "long",
  mark: 130,
  last: 130,
  entryPrice: 115,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(firstHarvest.claims.length, 1);
assert.equal(firstHarvest.claims[0]?.actionId, "harvest");
assert.equal(firstHarvest.claims[0]?.qty, 1);
assert.equal(firstHarvest.lots.find((lot) => lot.id === "a"), undefined);
assert.equal(firstHarvest.lots.find((lot) => lot.id === "b")?.qty, 1);

const secondHarvest = planExitClaims({
  actions: harvest,
  runtime: firstHarvest.runtime,
  lots: firstHarvest.lots,
  side: "long",
  mark: 130,
  last: 130,
  entryPrice: 115,
  nowMs: 2,
  conditionTrue: {},
});
assert.equal(secondHarvest.claims.length, 0);

const split = planExitClaims({
  actions: [
    {
      id: "tp",
      kind: "take_profit",
      scope: { kind: "percent", pct: 50 },
      groups: [],
      takeProfitPct: 10,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
    },
    {
      id: "again",
      kind: "take_profit",
      scope: { kind: "percent", pct: 50 },
      groups: [],
      takeProfitPct: 10,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
    },
  ],
  runtime: emptyExitRuntime(),
  lots: [
    { id: "a", qty: 4, price: 100 },
  ],
  side: "long",
  mark: 120,
  last: 120,
  entryPrice: 100,
  nowMs: 1,
  conditionTrue: {},
});
assert.deepEqual(
  split.claims.map((claim) => claim.qty),
  [2, 1],
);

const stopWins = planExitClaims({
  actions: [
    {
      id: "tp",
      kind: "take_profit",
      scope: { kind: "all" },
      groups: [],
      takeProfitPct: null,
      takeProfitPrice: 100,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
    },
    {
      id: "sl",
      kind: "stop_loss",
      scope: { kind: "all" },
      groups: [],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: 100,
      trailingDistance: null,
      trailingActivation: null,
    },
  ],
  runtime: emptyExitRuntime(),
  lots: [{ id: "a", qty: 2, price: 100 }],
  side: "long",
  mark: 100,
  last: 100,
  entryPrice: 100,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(stopWins.claims.length, 1);
assert.equal(stopWins.claims[0]?.kind, "stop_loss");

const trail = planExitClaims({
  actions: [
    {
      id: "trail",
      kind: "trailing_stop",
      scope: { kind: "all" },
      groups: [
        {
          anchor: { trigger: "webhook", webhookId: "arm" },
          rows: [],
        },
      ],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: 5,
      trailingActivation: null,
    },
  ],
  runtime: emptyExitRuntime(),
  lots: [{ id: "a", qty: 1, price: 100 }],
  side: "long",
  mark: 100,
  last: 100,
  entryPrice: 100,
  nowMs: 10,
  conditionTrue: { trail: true },
});
assert.equal(trail.claims.length, 0);
assert.equal(trail.runtime.arms.trail?.armedAt, 10);
assert.equal(trail.runtime.arms.trail?.peak, 100);

const trailHit = planExitClaims({
  actions: [
    {
      id: "trail",
      kind: "trailing_stop",
      scope: { kind: "all" },
      groups: [
        {
          anchor: { trigger: "webhook", webhookId: "arm" },
          rows: [],
        },
      ],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: 5,
      trailingActivation: null,
    },
  ],
  runtime: trail.runtime,
  lots: [{ id: "a", qty: 1, price: 100 }],
  side: "long",
  mark: 90,
  last: 90,
  entryPrice: 100,
  nowMs: 20,
  conditionTrue: { trail: false },
});
assert.equal(trailHit.claims.length, 0);
assert.equal(trailHit.runtime.arms.trail?.armedAt, 10);

const trailConfirmed = planExitClaims({
  actions: trailHit.claims.length === 0 ? [
    {
      id: "trail",
      kind: "trailing_stop",
      scope: { kind: "all" },
      groups: [
        {
          anchor: { trigger: "webhook", webhookId: "arm" },
          rows: [],
        },
      ],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: 5,
      trailingActivation: null,
    },
  ] : [],
  runtime: trailHit.runtime,
  lots: [{ id: "a", qty: 1, price: 100 }],
  side: "long",
  mark: 90,
  last: 90,
  entryPrice: 100,
  nowMs: 30,
  conditionTrue: { trail: true },
});
assert.equal(trailConfirmed.claims.length, 1);

const confirmedTp = {
  id: "tp",
  kind: "take_profit" as const,
  scope: { kind: "all" as const },
  groups: [
    {
      anchor: { trigger: "target" as const },
      rows: [{ trigger: "webhook" as const, webhookId: "arm" }],
    },
  ],
  takeProfitPct: 10,
  takeProfitPrice: null,
  stopLossPct: null,
  stopLossPrice: null,
  trailingDistance: null,
  trailingActivation: null,
};
const blockedTp = planExitClaims({
  actions: [confirmedTp],
  runtime: emptyExitRuntime(),
  lots: [{ id: "a", qty: 1, price: 100 }],
  side: "long",
  mark: 120,
  last: 120,
  entryPrice: 100,
  nowMs: 1,
  conditionTrue: { tp: false },
});
assert.equal(blockedTp.claims.length, 0);
const passedTp = planExitClaims({
  actions: [confirmedTp],
  runtime: emptyExitRuntime(),
  lots: [{ id: "a", qty: 1, price: 100 }],
  side: "long",
  mark: 120,
  last: 120,
  entryPrice: 100,
  nowMs: 1,
  conditionTrue: { tp: true },
});
assert.equal(passedTp.claims.length, 1);
const gate = exitActionGate({
  action: confirmedTp,
  side: "long",
  prices: { last: 120, mark: 120, index: null },
  barsByTimeframe: new Map(),
  firedWebhookId: null,
});
assert.equal(gate.confirm, false);
assert.equal(gate.needsPrice, true);
const gateOpen = exitActionGate({
  action: {
    ...confirmedTp,
    groups: [{ anchor: { trigger: "webhook", webhookId: "arm" }, rows: [] }],
    takeProfitPct: null,
  },
  side: "long",
  prices: { last: 120, mark: 120, index: null },
  barsByTimeframe: new Map(),
  firedWebhookId: "arm",
});
assert.equal(gateOpen.confirm, false);
assert.equal(gateOpen.needsPrice, true);
const openedIndicator = clausesFromExitActions([
  {
    id: "tp-ind",
    kind: "take_profit",
    scope: { kind: "all" },
    groups: [{ anchor: { trigger: "webhook", webhookId: "arm" }, rows: [] }],
    takeProfitPct: null,
    takeProfitPrice: null,
    stopLossPct: null,
    stopLossPrice: null,
    trailingDistance: null,
    trailingActivation: null,
  },
]);
assert.equal(openedIndicator?.[0]?.anchor.trigger, "target");
assert.equal(openedIndicator?.[0]?.rows[0]?.draft.trigger, "webhook");
assert.equal(openedIndicator?.[0]?.rows[0]?.draft.webhookId, "arm");

const legacy = clausesFromExitActions([
  {
    id: "old-trail",
    kind: "trailing_stop",
    scope: { kind: "all" },
    groups: [{ anchor: trendDraft, rows: [] }],
    takeProfitPct: null,
    takeProfitPrice: null,
    stopLossPct: null,
    stopLossPrice: null,
    trailingDistance: 2,
    trailingActivation: null,
  },
]);
assert.equal(legacy?.[0]?.anchor.trigger, "trail");
assert.equal(legacy?.[0]?.rows[0]?.draft.trigger, "trend");

const round = clausesFromExitActions(exitActionsFromJson(saved));
assert.equal(round?.[0]?.kind, "trailing_stop");
assert.equal(round?.[0]?.anchor.trigger, "trail");
assert.equal(round?.[0]?.rows[0]?.draft.trigger, "trend");

const firstTp = classicExitClause("take_profit");
const secondTp = classicExitClause("take_profit");
secondTp.key = "tp-2";
secondTp.scope = { kind: "percent", pct: 25 };
secondTp.levels = {
  ...emptyRepeatLevels(),
  style: "dca",
  method: "percent",
  basis: "first_entry",
  target: "4",
  orderType: "limit",
};
const secondSaved = exitActionsForSave([firstTp, secondTp], prices);
assert.equal(secondSaved?.[1]?.takeProfitPct, 4);
assert.equal(secondSaved?.[1]?.levels?.basis, "first_entry");
assert.equal(secondSaved?.[1]?.levels?.orderType, "limit");
assert.equal(secondSaved?.[1]?.levels?.method, "percent");
const secondRound = clausesFromExitActions(exitActionsFromJson(secondSaved));
assert.equal(secondRound?.[1]?.levels?.basis, "first_entry");
assert.equal(secondRound?.[1]?.levels?.target, "4");
assert.equal(secondRound?.[1]?.levels?.orderType, "limit");

const blankTp = classicExitClause("take_profit");
blankTp.key = "tp-blank";
blankTp.levels = { ...emptyRepeatLevels(), style: "dca", method: "percent", target: "" };
assert.match(exitCardsBlockReason([firstTp, blankTp]) ?? "", /target/i);

const firstTrail = classicExitClause("trailing_stop");
const secondTrail = classicExitClause("trailing_stop");
secondTrail.key = "trail-2";
secondTrail.levels = {
  ...emptyRepeatLevels(),
  style: "dca",
  trigger: "3",
  trail: "1",
};
const trailSaved = exitActionsForSave([firstTrail, secondTrail], prices);
assert.equal(trailSaved?.[1]?.trailingPct, 1);
assert.equal(trailSaved?.[1]?.trailingTriggerPct, 3);
assert.equal(trailSaved?.[1]?.levels?.trigger, "3");

const quietTrail = planExitClaims({
  actions: [trailSaved![1]!],
  runtime: emptyExitRuntime(),
  lots: [{ id: "a", qty: 1, price: 100 }],
  side: "long",
  mark: 101,
  last: 101,
  entryPrice: 100,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(quietTrail.claims.length, 0);

const firstStop = classicExitClause("stop_loss");
const secondStop = classicExitClause("stop_loss");
secondStop.key = "sl-2";
secondStop.levels = {
  ...emptyRepeatLevels(),
  style: "dca",
  basis: "first_entry",
  method: "percent",
  target: "2",
  breakeven: true,
  breakevenActivation: "1.5",
};
const stopSaved = exitActionsForSave([firstStop, secondStop], prices);
assert.equal(stopSaved?.[1]?.stopLossPct, 2);
assert.equal(stopSaved?.[1]?.levels?.basis, "first_entry");
assert.equal(stopSaved?.[1]?.levels?.breakeven, true);
assert.match(exitCardsBlockReason([firstStop, { ...secondStop, levels: { ...secondStop.levels!, breakevenActivation: "" } }]) ?? "", /breakeven/i);

const flexTp = classicExitClause("take_profit");
flexTp.key = "flex-tp";
flexTp.levels = {
  ...emptyRepeatLevels(),
  style: "flex",
  method: "price",
  target: "25000",
  trigger: "mark",
  orderType: "market",
};
const flexSaved = exitActionsForSave([classicExitClause("take_profit"), flexTp], prices);
assert.equal(flexSaved?.[1]?.takeProfitPrice, 25000);
assert.equal(flexSaved?.[1]?.takeProfitPct, null);

const flexLegacyTrail = classicExitClause("trailing_stop");
flexLegacyTrail.key = "flex-trail-legacy";
flexLegacyTrail.levels = {
  ...emptyRepeatLevels(),
  style: "flex",
  trigger: "65000",
  trail: "200",
};
const flexLegacySaved = exitActionsForSave(
  [classicExitClause("trailing_stop"), flexLegacyTrail],
  prices,
);
assert.equal(flexLegacySaved?.[1]?.trailingActivation, 65000);
assert.equal(flexLegacySaved?.[1]?.trailingTriggerPct, null);
assert.equal(flexLegacySaved?.[1]?.trailingDistance, 200);
const flexLegacyRound = clausesFromExitActions(exitActionsFromJson(flexLegacySaved));
assert.equal(flexLegacyRound?.[1]?.levels?.method, "price");

const flexPercentTrail = classicExitClause("trailing_stop");
flexPercentTrail.key = "flex-trail-pct";
flexPercentTrail.levels = {
  ...emptyRepeatLevels(),
  style: "flex",
  method: "percent",
  trigger: "3",
  trail: "200",
};
const flexPercentSaved = exitActionsForSave(
  [classicExitClause("trailing_stop"), flexPercentTrail],
  prices,
);
assert.equal(flexPercentSaved?.[1]?.trailingTriggerPct, 3);
assert.equal(flexPercentSaved?.[1]?.trailingActivation, null);

const dcaPriceTrail = classicExitClause("trailing_stop");
dcaPriceTrail.key = "dca-trail-price";
dcaPriceTrail.levels = {
  ...emptyRepeatLevels(),
  style: "dca",
  method: "price",
  trigger: "90",
  trail: "1",
};
const dcaPriceSaved = exitActionsForSave(
  [classicExitClause("trailing_stop"), dcaPriceTrail],
  { ...prices, trailingDistance: null, trailingPct: 2, trailingTriggerPct: 4 },
);
assert.equal(dcaPriceSaved?.[1]?.trailingActivation, 90);
assert.equal(dcaPriceSaved?.[1]?.trailingPct, 1);
assert.equal(dcaPriceSaved?.[1]?.trailingTriggerPct, null);

const onlyTrail = classicExitClause("trailing_stop");
assert.equal(exitActionsForSave([onlyTrail], prices), null);
assert.equal(trailFitsColumns(prices), true);
const percentPrices: ExitSidePrices = {
  ...prices,
  trailingActivation: null,
  trailingTriggerPct: 2,
};
assert.equal(trailFitsColumns(percentPrices), false);
assert.equal(exitActionsForSave([onlyTrail], percentPrices)?.[0]?.trailingTriggerPct, 2);
assert.equal(exitActionsForSave([classicExitClause("take_profit")], percentPrices), null);
assert.equal(exitActionsForSave([onlyTrail], percentPrices)?.[0]?.trailingActivation, null);
const dcaPricePrices: ExitSidePrices = {
  ...prices,
  trailingDistance: null,
  trailingPct: 1,
  trailingActivation: 90,
  trailingTriggerPct: null,
};
assert.equal(trailFitsColumns(dcaPricePrices), false);
assert.equal(exitActionsForSave([onlyTrail], dcaPricePrices)?.[0]?.trailingActivation, 90);
assert.equal(
  exitActionsForSave([onlyTrail], {
    ...prices,
    trailingDistance: null,
    trailingPct: 1,
    trailingTriggerPct: 2,
    trailingActivation: null,
  }),
  null,
);

assert.equal(trailActivationKind({ style: "flex", trigger: "65000" }), "price");
assert.equal(trailActivationKind({ style: "dca", trigger: "3" }), "percent");
assert.equal(trailActivationKind({}), "percent");
assert.deepEqual(
  savedTrailActivation({ activePrice: 80000 }),
  { kind: "price", value: "80000" },
);
assert.deepEqual(
  savedTrailActivation({ triggerPct: 2 }),
  { kind: "percent", value: "2" },
);
assert.equal(
  trailingGateError(
    [{ ...flexPercentSaved![1]!, trailingTriggerPct: null, trailingActivation: null }],
    "percent",
  ),
  "Enter an activation percent.",
);
assert.equal(trailingGateError([flexPercentSaved![1]!], "percent"), null);

console.log("exit-actions.check ok");
