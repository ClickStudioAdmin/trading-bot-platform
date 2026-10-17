import assert from "node:assert/strict";
import {
  classicExitClause,
  customExitClause,
  emptyExitClause,
} from "./exit-clauses";
import {
  clausesFromExitActions,
  emptyExitRuntime,
  exitActionsForSave,
  exitActionsFromJson,
  exitCardsBlockReason,
  exitSideUsesColumns,
  planExitClaims,
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

const armed = classicExitClause("trailing_stop");
armed.anchor = {
  trigger: "trend",
  spec: {
    kind: "supertrend",
    timeframe: "15",
    compare: "cross_gte",
    level: null,
    levelTo: null,
    period: 10,
    slowPeriod: null,
    multiplier: 3,
  },
};
assert.equal(exitSideUsesColumns([armed]), false);
const saved = exitActionsForSave([armed], prices);
assert.equal(saved?.length, 1);
assert.equal(saved?.[0]?.kind, "trailing_stop");
assert.equal(saved?.[0]?.groups.length, 1);
assert.equal(saved?.[0]?.trailingDistance, 2);
assert.equal(exitCardsBlockReason([armed]), null);

const half = classicExitClause("take_profit");
half.scope = { kind: "percent", pct: 50 };
const rest = classicExitClause("trailing_stop");
rest.key = "trail-rest";
rest.scope = { kind: "remainder" };
rest.anchor = {
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
};
assert.equal(exitActionsForSave([half, rest], prices)?.[1]?.scope.kind, "remainder");
assert.equal(exitCardsBlockReason([half, rest]), null);

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
assert.equal(trailHit.claims.length, 1);
assert.equal(trailHit.runtime.arms.trail?.armedAt, 10);

const round = clausesFromExitActions(exitActionsFromJson(saved));
assert.equal(round?.[0]?.kind, "trailing_stop");
assert.equal(round?.[0]?.anchor.trigger, "trend");

console.log("exit-actions.check ok");
