import assert from "node:assert/strict";
import {
  breakevenExitClause,
  classicExitClause,
  customExitClause,
  emptyExitClause,
  emptyRepeatLevels,
  trailActivationKind,
} from "./exit-clauses";
import {
  actionUsesLotReference,
  clausesFromExitActions,
  describeExitBook,
  executionLabel,
  emptyExitRuntime,
  evaluateExitActions,
  exitBookForClassic,
  exitRuntimeFromJson,
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
assert.equal(flexPercentSaved?.[1]?.trailingPct, 200);
assert.equal(flexPercentSaved?.[1]?.trailingDistance, null);

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
const flexPercentColumns: ExitSidePrices = {
  ...prices,
  trailingDistance: null,
  trailingPct: 1.5,
  trailingTriggerPct: 2,
  trailingActivation: null,
};
assert.equal(trailFitsColumns(flexPercentColumns, "flex"), false);
const flexColumnSaved = exitActionsForSave([onlyTrail], flexPercentColumns, "flex");
assert.equal(flexColumnSaved?.[0]?.trailingPct, 1.5);
assert.equal(flexColumnSaved?.[0]?.trailingTriggerPct, 2);
assert.equal(flexColumnSaved?.[0]?.trailingDistance, null);
assert.equal(trailFitsColumns(flexPercentColumns, "dca"), true);
assert.equal(exitActionsForSave([onlyTrail], flexPercentColumns, "dca"), null);

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

const breakevenPrices: ExitSidePrices = {
  ...prices,
  breakevenActivationPct: 1,
  breakevenOffsetPct: 0.2,
};
const simpleBreakeven = breakevenExitClause();
assert.equal(exitSideUsesColumns([simpleBreakeven]), true);
assert.equal(exitActionsForSave([simpleBreakeven], breakevenPrices), null);
assert.equal(
  exitCardsBlockReason([simpleBreakeven, breakevenExitClause()]),
  "Only one Breakeven Stop on a side.",
);
const breakevenAndRsi = breakevenExitClause();
breakevenAndRsi.rows = [
  {
    key: "rsi",
    join: "and",
    draft: {
      trigger: "indicator",
      spec: {
        kind: "rsi",
        timeframe: "15",
        compare: "gte",
        level: 70,
        levelTo: null,
        period: 14,
        slowPeriod: null,
        multiplier: null,
      },
    },
  },
];
const breakevenSaved = exitActionsForSave([breakevenAndRsi], breakevenPrices);
assert.equal(breakevenSaved?.[0]?.kind, "breakeven");
assert.equal(breakevenSaved?.[0]?.breakevenActivationPct, 1);
assert.equal(breakevenSaved?.[0]?.breakevenOffsetPct, 0.2);
assert.equal(breakevenSaved?.[0]?.stopLossPct ?? null, null);
assert.equal(breakevenSaved?.[0]?.scope.kind, "all");

const profitOnly: StoredExitAction = {
  id: "be",
  kind: "breakeven",
  scope: { kind: "all" },
  groups: [{ anchor: { trigger: "profit" }, rows: [] }],
  takeProfitPct: null,
  takeProfitPrice: null,
  stopLossPct: null,
  stopLossPrice: null,
  trailingDistance: null,
  trailingActivation: null,
  breakevenActivationPct: 1,
  breakevenOffsetPct: 0.2,
};
function breakevenAt(mark: number, done = false) {
  return evaluateExitActions({
    actions: [profitOnly],
    runtime: emptyExitRuntime(),
    lots: [{ id: "position", qty: 1, price: 100 }],
    side: "long",
    mark,
    last: mark,
    entryPrice: 100,
    nowMs: 1,
    barsByTimeframe: new Map(),
    breakevenDone: done,
  });
}
const moved = breakevenAt(102);
assert.equal(moved.claims.length, 0);
assert.equal(moved.breakeven?.activationPct, 1);
assert.equal(moved.breakeven?.offsetPct, 0.2);
assert.equal(moved.breakeven?.qty, null);
assert.equal(moved.book.actions[0]?.status, "moving");
assert.equal(moved.book.trailingOrBreakeven.provenQty, 0);
assert.equal(moved.runtime.book?.atMs, 1);
assert.equal(breakevenAt(100.5).breakeven, null);
assert.equal(breakevenAt(100.5).book.actions[0]?.status, "waiting");
const latched = breakevenAt(102, true);
assert.equal(latched.breakeven, null);
assert.equal(latched.book.actions[0]?.status, "done");
assert.equal(latched.book.trailingOrBreakeven.provenPct, 100);
const halfBreakeven = breakevenExitClause();
halfBreakeven.scope = { kind: "percent", pct: 50 };
assert.equal(exitSideUsesColumns([halfBreakeven]), false);
assert.equal(exitActionsForSave([halfBreakeven], breakevenPrices)?.[0]?.scope.kind, "percent");
const blankPercent = breakevenExitClause();
blankPercent.scope = { kind: "percent", pct: null };
assert.match(exitCardsBlockReason([blankPercent]) ?? "", /percent/i);
const halfMoved = evaluateExitActions({
  actions: [{ ...profitOnly, id: "be-half", scope: { kind: "percent", pct: 50 } }],
  runtime: emptyExitRuntime(),
  lots: [{ id: "position", qty: 4, price: 100 }],
  side: "long",
  mark: 102,
  last: 102,
  entryPrice: 100,
  nowMs: 2,
  barsByTimeframe: new Map(),
});
assert.equal(halfMoved.breakeven?.qty, 2);
assert.equal(halfMoved.book.trailingOrBreakeven.provenQty, 0);
const halfLatched = evaluateExitActions({
  actions: [{ ...profitOnly, id: "be-half", scope: { kind: "percent", pct: 50 } }],
  runtime: emptyExitRuntime(),
  lots: [{ id: "position", qty: 4, price: 100 }],
  side: "long",
  mark: 102,
  last: 102,
  entryPrice: 100,
  nowMs: 3,
  barsByTimeframe: new Map(),
  breakevenDone: true,
});
assert.equal(halfLatched.book.actions[0]?.status, "done");
assert.equal(halfLatched.book.trailingOrBreakeven.provenQty, 2);

const halfStops = describeExitBook({
  source: "actions",
  actions: [
    {
      id: "stop-a",
      kind: "stop_loss",
      scope: { kind: "percent", pct: 50 },
      groups: [{ anchor: { trigger: "stop" }, rows: [] }],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: 2,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
    },
    {
      id: "stop-b",
      kind: "stop_loss",
      scope: { kind: "percent", pct: 50 },
      groups: [{ anchor: { trigger: "stop" }, rows: [] }],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: 4,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
    },
  ],
  runtime: emptyExitRuntime(),
  lots: [{ id: "position", qty: 4, price: 100 }],
  side: "long",
  mark: 100,
  last: 100,
  entryPrice: 100,
  nowMs: 5,
  claims: [],
});
assert.equal(halfStops.protective.provenQty, 2);
assert.equal(halfStops.protective.stackedQty, 4);
assert.equal(halfStops.protective.provenPct, 50);
assert.equal(halfStops.protective.stackedPct, 100);
assert.equal(halfStops.actions[0]?.groups[0]?.leaves[0]?.label, "Stop Hit");

const overlapped = describeExitBook({
  source: "actions",
  actions: ["stop-a", "stop-b"].map((id) => ({
    id,
    kind: "stop_loss" as const,
    scope: { kind: "all" as const },
    groups: [{ anchor: { trigger: "stop" as const }, rows: [] }],
    takeProfitPct: null,
    takeProfitPrice: null,
    stopLossPct: 2,
    stopLossPrice: null,
    trailingDistance: null,
    trailingActivation: null,
  })),
  runtime: emptyExitRuntime(),
  lots: [{ id: "position", qty: 4, price: 100 }],
  side: "long",
  mark: 100,
  last: 100,
  entryPrice: 100,
  nowMs: 5,
  claims: [],
});
assert.equal(overlapped.protective.provenPct, 100);
assert.equal(overlapped.protective.stackedPct, 100);
assert.equal(overlapped.noLoss.provenPct, 0);

const mixedCover = describeExitBook({
  source: "actions",
  actions: [
    {
      id: "loss-stop",
      kind: "stop_loss",
      scope: { kind: "all" },
      groups: [{ anchor: { trigger: "stop" }, rows: [] }],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: 90,
      trailingDistance: null,
      trailingActivation: null,
    },
    {
      id: "be-part",
      kind: "breakeven",
      scope: { kind: "percent", pct: 40 },
      groups: [{ anchor: { trigger: "profit" }, rows: [] }],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
      breakevenActivationPct: 1,
      breakevenOffsetPct: 0,
    },
  ],
  runtime: emptyExitRuntime(),
  lots: [{ id: "position", qty: 10, price: 100 }],
  side: "long",
  mark: 102,
  last: 102,
  entryPrice: 100,
  nowMs: 6,
  claims: [],
  breakevenDone: true,
});
assert.equal(mixedCover.protective.provenPct, 100);
assert.equal(mixedCover.noLoss.provenPct, 40);

const tracked = exitBookForClassic({
  side: "long",
  qty: 2,
  entryPrice: 100,
  mark: 110,
  last: 110,
  nowMs: 9,
  trailingDistance: 1,
  trailingActivation: 105,
  trailingPeak: 110,
  stopLossPrice: 90,
});
assert.equal(tracked.source, "classic");
assert.equal(tracked.actions.find((action) => action.kind === "trailing_stop")?.status, "protecting");
assert.equal(tracked.trailingOrBreakeven.provenPct, 100);
assert.equal(tracked.byKind.stop_loss.provenPct, 100);
assert.equal(tracked.protective.provenPct, 100);
assert.equal(tracked.noLoss.provenPct, 100);

const lossStop = exitBookForClassic({
  side: "long",
  qty: 2,
  entryPrice: 100,
  mark: 110,
  last: 110,
  nowMs: 9,
  stopLossPrice: 90,
});
assert.equal(lossStop.protective.provenPct, 100);
assert.equal(lossStop.noLoss.provenPct, 0);
const shortCovered = exitBookForClassic({
  side: "short",
  qty: 2,
  entryPrice: 100,
  mark: 90,
  last: 90,
  nowMs: 9,
  stopLossPrice: 90,
});
assert.equal(shortCovered.noLoss.provenPct, 100);
const shortLoss = exitBookForClassic({
  side: "short",
  qty: 2,
  entryPrice: 100,
  mark: 90,
  last: 90,
  nowMs: 9,
  stopLossPrice: 110,
});
assert.equal(shortLoss.protective.provenPct, 100);
assert.equal(shortLoss.noLoss.provenPct, 0);
const trailStillLosing = exitBookForClassic({
  side: "long",
  qty: 2,
  entryPrice: 100,
  mark: 103,
  last: 103,
  nowMs: 9,
  trailingDistance: 5,
  trailingActivation: 101,
  trailingPeak: 103,
});
assert.equal(trailStillLosing.protective.provenPct, 100);
assert.equal(trailStillLosing.noLoss.provenPct, 0);

const classicQuietTrail = exitBookForClassic({
  side: "long",
  qty: 2,
  entryPrice: 100,
  mark: 101,
  last: 101,
  nowMs: 9,
  trailingDistance: 1,
  trailingActivation: 105,
});
assert.equal(classicQuietTrail.actions[0]?.status, "waiting");
assert.equal(classicQuietTrail.trailingOrBreakeven.provenQty, 0);

const classicMove = exitBookForClassic({
  side: "long",
  qty: 2,
  entryPrice: 100,
  mark: 102,
  last: 102,
  nowMs: 10,
  breakevenActivationPct: 1,
  breakevenOffsetPct: 0,
  breakeven: { activationPct: 1, offsetPct: 0, qty: null },
});
assert.equal(classicMove.actions[0]?.status, "moving");
assert.equal(classicMove.trailingOrBreakeven.provenQty, 0);
assert.equal(classicMove.noLoss.provenQty, 0);
const classicLatched = exitBookForClassic({
  side: "long",
  qty: 2,
  entryPrice: 100,
  mark: 102,
  last: 102,
  nowMs: 11,
  breakevenDone: true,
  breakevenActivationPct: 1,
});
assert.equal(classicLatched.actions[0]?.status, "done");
assert.equal(classicLatched.trailingOrBreakeven.provenPct, 100);
assert.equal(classicLatched.noLoss.provenPct, 100);

const roundTrip = exitRuntimeFromJson({
  arms: { "classic:trailing_stop": { armedAt: 9, peak: 110, condition: true, scopeLive: true } },
  book: tracked,
});
assert.equal(roundTrip.book?.trailingOrBreakeven.provenPct, 100);
assert.equal(roundTrip.book?.noLoss.provenPct, 100);
assert.equal(roundTrip.arms["classic:trailing_stop"]?.peak, 110);
const staleBook = { ...tracked } as { noLoss?: unknown };
delete staleBook.noLoss;
assert.equal(
  exitRuntimeFromJson({ arms: { a: { armedAt: 1, peak: 2, condition: true } }, book: staleBook })
    .book?.noLoss.provenPct,
  0,
);
assert.equal(exitRuntimeFromJson({ arms: { a: { armedAt: 1, peak: 2, condition: false } } }).book, undefined);

const wickTrail: StoredExitAction = {
  id: "trail",
  kind: "trailing_stop",
  scope: { kind: "all" },
  groups: [],
  takeProfitPct: null,
  takeProfitPrice: null,
  stopLossPct: null,
  stopLossPrice: null,
  trailingDistance: 5,
  trailingActivation: 110,
  trailingPct: null,
  trailingTriggerPct: null,
  breakevenActivationPct: null,
  breakevenOffsetPct: null,
};
function trailBar(input: { close: number; favorable?: number; adverse?: number }) {
  return evaluateExitActions({
    actions: [wickTrail],
    runtime: emptyExitRuntime(),
    lots: [{ id: "position", qty: 1, price: 100 }],
    side: "long",
    mark: input.close,
    last: input.close,
    favorable: input.favorable,
    adverse: input.adverse,
    entryPrice: 100,
    nowMs: 4,
    barsByTimeframe: new Map(),
  });
}
assert.equal(trailBar({ close: 108 }).runtime.arms.trail?.peak ?? null, null);
const armedOnHigh = trailBar({ close: 108, favorable: 112, adverse: 108 });
assert.equal(armedOnHigh.claims.length, 0);
assert.equal(armedOnHigh.runtime.arms.trail?.peak, 112);

const lotStop = {
  id: "sl",
  kind: "stop_loss" as const,
  scope: { kind: "all" as const },
  reference: "lot" as const,
  groups: [] as StoredExitAction["groups"],
  takeProfitPct: null,
  takeProfitPrice: null,
  stopLossPct: 5,
  stopLossPrice: null,
  trailingDistance: null,
  trailingActivation: null,
};
const twoLots = [
  { id: "a", qty: 1, price: 100 },
  { id: "b", qty: 1, price: 80 },
];
const lotHit = planExitClaims({
  actions: [lotStop],
  runtime: emptyExitRuntime(),
  lots: twoLots,
  side: "long",
  mark: 94,
  last: 94,
  entryPrice: 90,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(actionUsesLotReference(lotStop), true);
assert.deepEqual(
  lotHit.claims.map((claim) => claim.qty),
  [1],
);
assert.equal(lotHit.lots.find((lot) => lot.id === "a"), undefined);
assert.equal(lotHit.lots.find((lot) => lot.id === "b")?.qty, 1);

const averageStop: StoredExitAction = { ...lotStop, reference: "average" };
const averageQuiet = planExitClaims({
  actions: [averageStop],
  runtime: emptyExitRuntime(),
  lots: twoLots,
  side: "long",
  mark: 94,
  last: 94,
  entryPrice: 90,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(averageQuiet.claims.length, 0);
assert.equal(executionLabel(averageStop), "Average");
assert.equal(executionLabel(lotStop), "Per lot");
const wickIgnored = planExitClaims({
  actions: [lotStop],
  runtime: emptyExitRuntime(),
  lots: [{ id: "a", qty: 1, price: 100 }],
  side: "long",
  mark: 98,
  last: 98,
  adverse: 90,
  entryPrice: 100,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(wickIgnored.claims.length, 0, "a percent stop uses the mark, not the wick");
const closeHit = planExitClaims({
  actions: [lotStop],
  runtime: emptyExitRuntime(),
  lots: [{ id: "a", qty: 1, price: 100 }],
  side: "long",
  mark: 94,
  last: 94,
  adverse: 99,
  entryPrice: 100,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(closeHit.claims.length, 1);

const gated = planExitClaims({
  actions: [{ ...lotStop, groups: [{ anchor: { trigger: "stop" }, rows: [] }] }],
  runtime: emptyExitRuntime(),
  lots: twoLots,
  side: "long",
  mark: 90,
  last: 90,
  adverse: 90,
  entryPrice: 90,
  nowMs: 1,
  conditionTrue: { sl: false },
});
assert.equal(gated.claims.length, 0);

const winnersOnly = planExitClaims({
  actions: [{ ...lotStop, scope: { kind: "fills", minProfitPct: 1 } }],
  runtime: emptyExitRuntime(),
  lots: [
    { id: "winner", qty: 1, price: 100 },
    { id: "loser", qty: 1, price: 130 },
  ],
  side: "long",
  mark: 110,
  last: 110,
  adverse: 110,
  entryPrice: 115,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(winnersOnly.claims.length, 0);

const lotTrail: StoredExitAction = {
  id: "trail",
  kind: "trailing_stop",
  scope: { kind: "all" },
  reference: "lot",
  groups: [],
  takeProfitPct: null,
  takeProfitPrice: null,
  stopLossPct: null,
  stopLossPrice: null,
  trailingDistance: 5,
  trailingActivation: null,
  trailingTriggerPct: 1,
};
const trailLots = [
  { id: "a", qty: 1, price: 100 },
  { id: "b", qty: 1, price: 140 },
];
const trailArmed = planExitClaims({
  actions: [lotTrail],
  runtime: emptyExitRuntime(),
  lots: trailLots,
  side: "long",
  mark: 110,
  last: 110,
  favorable: 110,
  adverse: 110,
  entryPrice: 120,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(trailArmed.claims.length, 0);
assert.equal(trailArmed.runtime.arms.trail?.lots?.a?.peak, 110);
assert.equal(trailArmed.runtime.arms.trail?.lots?.b?.peak ?? null, null);
const trailFired = planExitClaims({
  actions: [lotTrail],
  runtime: trailArmed.runtime,
  lots: trailLots,
  side: "long",
  mark: 108,
  last: 108,
  favorable: 110,
  adverse: 104,
  entryPrice: 120,
  nowMs: 2,
  conditionTrue: {},
});
assert.equal(trailFired.claims.length, 1);
assert.equal(trailFired.claims[0]?.qty, 1);
assert.equal(trailFired.claims[0]?.price, 105);
assert.equal(trailFired.lots.find((lot) => lot.id === "b")?.qty, 1);

const shortTrail: StoredExitAction = {
  ...lotTrail,
  trailingDistance: null,
  trailingPct: 1,
  trailingTriggerPct: 5,
};
const shortLots = [
  { id: "first", qty: 4.73, price: 105.69 },
  { id: "add", qty: 4.682, price: 106.78 },
];
const shortArmed = planExitClaims({
  actions: [shortTrail],
  runtime: emptyExitRuntime(),
  lots: shortLots,
  side: "short",
  mark: 101,
  last: 101,
  favorable: 100,
  adverse: 102,
  entryPrice: 106.23,
  nowMs: 1,
  conditionTrue: {},
});
assert.equal(shortArmed.claims.length, 0, "the arming bar does not fill");
assert.equal(shortArmed.runtime.arms.trail?.lots?.add?.peak, 100);
assert.equal(shortArmed.runtime.arms.trail?.lots?.first?.peak, 100);
const shortBounce = planExitClaims({
  actions: [shortTrail],
  runtime: shortArmed.runtime,
  lots: shortLots,
  side: "short",
  mark: 104.39,
  last: 104.39,
  favorable: 103,
  adverse: 105,
  entryPrice: 106.23,
  nowMs: 2,
  conditionTrue: {},
});
assert.equal(shortBounce.claims.length, 2);
assert.ok(
  shortBounce.claims.every((claim) => (claim.price ?? 0) < 104.39),
  "a short trail sits above the low and fills when price trades back up through it",
);
assert.deepEqual(
  shortBounce.claims.map((claim) => claim.entry),
  [105.69, 106.78],
);

const lotBreakeven: StoredExitAction = {
  id: "be",
  kind: "breakeven",
  scope: { kind: "all" },
  reference: "lot",
  groups: [],
  takeProfitPct: null,
  takeProfitPrice: null,
  stopLossPct: null,
  stopLossPrice: null,
  trailingDistance: null,
  trailingActivation: null,
  breakevenActivationPct: 1,
  breakevenOffsetPct: 0,
};
const beLots = [
  { id: "a", qty: 1, price: 100 },
  { id: "b", qty: 1, price: 130 },
];
const beLatched = evaluateExitActions({
  actions: [lotBreakeven],
  runtime: emptyExitRuntime(),
  lots: beLots,
  side: "long",
  mark: 102,
  last: 102,
  favorable: 102,
  adverse: 102,
  entryPrice: 115,
  nowMs: 1,
  barsByTimeframe: new Map(),
});
assert.equal(beLatched.claims.length, 0);
assert.equal(beLatched.breakeven, null);
assert.equal(beLatched.runtime.arms.be?.lots?.a?.breakeven, true);
const wickLatch = evaluateExitActions({
  actions: [lotBreakeven],
  runtime: emptyExitRuntime(),
  lots: [{ id: "a", qty: 1, price: 100 }],
  side: "long",
  mark: 100.4,
  last: 100.4,
  favorable: 102,
  adverse: 100.4,
  entryPrice: 100,
  nowMs: 1,
  barsByTimeframe: new Map(),
});
assert.equal(wickLatch.runtime.arms.be?.lots?.a?.breakeven, false);
assert.equal(beLatched.runtime.arms.be?.lots?.b?.breakeven, false);
assert.equal(beLatched.book.actions[0]?.status, "protecting");
const beClosed = evaluateExitActions({
  actions: [lotBreakeven],
  runtime: beLatched.runtime,
  lots: beLots,
  side: "long",
  mark: 101,
  last: 101,
  favorable: 102,
  adverse: 100,
  entryPrice: 115,
  nowMs: 2,
  barsByTimeframe: new Map(),
});
assert.equal(beClosed.claims.length, 1);
assert.equal(beClosed.claims[0]?.kind, "breakeven");
assert.equal(beClosed.lots.find((lot) => lot.id === "b")?.qty, 1);

const remembered = exitRuntimeFromJson({
  arms: {
    trail: {
      armedAt: 1,
      peak: 110,
      condition: true,
      scopeLive: true,
      lots: { a: { peak: 110, breakeven: false } },
    },
  },
});
assert.equal(remembered.arms.trail?.lots?.a?.peak, 110);

const freshLot = emptyExitClause();
freshLot.kind = "trailing_stop";
freshLot.anchor = { trigger: "trail" };
assert.equal(exitActionsForSave([freshLot], prices)?.[0]?.reference, "lot");
assert.equal(exitActionsForSave([classicExitClause("trailing_stop")], prices), null);
const priceStop = emptyExitClause();
priceStop.kind = "stop_loss";
priceStop.anchor = { trigger: "stop" };
assert.equal(
  exitActionsForSave([priceStop], { ...prices, stopLossPct: null, stopLossPrice: 90 }),
  null,
);
const percentStop = emptyExitClause();
percentStop.kind = "stop_loss";
percentStop.anchor = { trigger: "stop" };
assert.equal(exitActionsForSave([percentStop], prices)?.[0]?.reference, "lot");
const opened = clausesFromExitActions(exitActionsForSave([freshLot], prices));
assert.equal(opened?.[0]?.reference, "lot");

console.log("exit-actions.check ok");
