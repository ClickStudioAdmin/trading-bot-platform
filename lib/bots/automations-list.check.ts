import assert from "node:assert/strict";
import {
  automationsBotBlotterCells,
  automationsBotFiltersActive,
  automationsListViewKey,
  parseAutomationsListView,
  serializeAutomationsListView,
  botModeLabel,
  botPairBaseCoin,
  compareAutomationsBot,
  dcaBotPair,
  dcaBotSummary,
  dcaListStatus,
  filterAutomationsBots,
  deskBotRows,
  missingById,
  rowsForDesk,
  futuresAutomationsBotBlotter,
  paperAutomationsBotBlotter,
  paperBotPair,
  paperBotSummary,
  perpsBotPair,
  perpsBotSummary,
  perpsListRecipe,
  paperListRecipe,
} from "./automations-list";
import {
  automationsBotBlotterHref,
  automationsBotReturn,
  automationsReturnHref,
  focusedBotTitle,
} from "./automations-path";
import { pruneRemovedIds, withRemovedIds } from "@/lib/table-chrome";
import { defaultFuturesAutomationForm, futuresRuleToForm } from "@/lib/futures/automation";
import { paperConfigToFormValues, defaultPaperLayer } from "@/lib/engine/rules";
import { templateParamSections } from "@/lib/backtest/param-sections";
import { parseListedRecipe } from "@/lib/backtest/library";
import {
  perpsRecipeToRule,
  recipesMatchReplayFields,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
} from "@/lib/templates/recipe";
import type { DcaPlaybook } from "@/lib/dca/playbook";

assert.deepEqual(
  missingById(new Set(["a"]), [{ id: "a" }, { id: "b" }, { id: "" }]).map(
    (row) => row.id,
  ),
  ["b"],
);

assert.deepEqual(
  rowsForDesk({
    deskChanged: false,
    current: [{ id: "cloud-1" }, { id: "cloud-2" }],
    incoming: [{ id: "cloud-2" }, { id: "cloud-3" }],
    id: (row) => row.id,
  }).map((row) => row.id),
  ["cloud-3", "cloud-1", "cloud-2"],
);
assert.deepEqual(
  rowsForDesk({
    deskChanged: true,
    current: [{ id: "cloud-1" }, { id: "cloud-2" }],
    incoming: [{ id: "hyper-1" }],
    id: (row) => row.id,
  }).map((row) => row.id),
  ["hyper-1"],
);
assert.deepEqual(
  rowsForDesk({
    deskChanged: true,
    current: [{ id: "cloud-1" }],
    incoming: [],
    id: (row) => row.id,
  }),
  [],
);
const sameDesk = [{ id: "cloud-1" }];
assert.equal(
  rowsForDesk({
    deskChanged: false,
    current: sameDesk,
    incoming: [{ id: "cloud-1" }],
    id: (row) => row.id,
  }),
  sameDesk,
);
const kept = [{ id: "a" }, { id: "b" }];
assert.equal(
  rowsForDesk({
    deskChanged: false,
    current: kept,
    incoming: [{ id: "a" }, { id: "b" }],
    id: (row) => row.id,
    omitIds: new Set(),
  }),
  kept,
);
assert.deepEqual(
  rowsForDesk({
    deskChanged: false,
    current: [{ id: "a" }, { id: "b" }, { id: "c" }],
    incoming: [{ id: "a" }, { id: "b" }, { id: "c" }],
    id: (row) => row.id,
    omitIds: new Set(["b"]),
  }).map((row) => row.id),
  ["a", "c"],
);
assert.deepEqual(
  rowsForDesk({
    deskChanged: false,
    current: [{ id: "a" }, { id: null }],
    incoming: [{ id: "b" }, { id: "a" }],
    id: (row) => row.id,
    omitIds: new Set(["b"]),
  }).map((row) => row.id),
  ["a", null],
);

const sameRemoved = new Set(["a"]);
assert.equal(withRemovedIds(sameRemoved, ["a", " "]), sameRemoved);
assert.deepEqual([...withRemovedIds(sameRemoved, ["b"])], ["a", "b"]);
assert.equal(pruneRemovedIds(sameRemoved, ["a", "b"]), sameRemoved);
assert.equal(pruneRemovedIds(new Set(), ["a"]).size, 0);
assert.deepEqual([...pruneRemovedIds(sameRemoved, ["b"])], []);

const hidden = deskBotRows({
  deskChanged: false,
  current: [{ id: "a" }, { id: "b" }],
  incoming: [{ id: "a" }, { id: "b" }, { id: "c" }],
  removedIds: new Set(["b"]),
  id: (row) => row.id,
});
assert.deepEqual(
  hidden.rows.map((row) => row.id),
  ["c", "a"],
);
assert.equal(hidden.removedIds.has("b"), true);

const staleServer = deskBotRows({
  deskChanged: false,
  current: [{ id: "a" }],
  incoming: [{ id: "b" }, { id: "a" }],
  removedIds: new Set(["b"]),
  id: (row) => row.id,
});
assert.deepEqual(
  staleServer.rows.map((row) => row.id),
  ["a"],
);
assert.equal(staleServer.removedIds.has("b"), true);

const serverCaughtUp = deskBotRows({
  deskChanged: false,
  current: [{ id: "a" }, { id: "b" }],
  incoming: [{ id: "a" }],
  removedIds: new Set(["b"]),
  id: (row) => row.id,
});
assert.deepEqual(
  serverCaughtUp.rows.map((row) => row.id),
  ["a"],
);
const cleared = deskBotRows({
  deskChanged: false,
  current: serverCaughtUp.rows,
  incoming: [{ id: "a" }],
  removedIds: serverCaughtUp.removedIds,
  id: (row) => row.id,
});
assert.equal(cleared.removedIds.size, 0);
assert.equal(cleared.rows, serverCaughtUp.rows);

const switchedDesk = deskBotRows({
  deskChanged: true,
  current: [{ id: "a" }],
  incoming: [{ id: "z" }],
  removedIds: new Set(["a"]),
  id: (row) => row.id,
});
assert.deepEqual(
  switchedDesk.rows.map((row) => row.id),
  ["z"],
);
assert.equal(switchedDesk.removedIds.size, 0);

assert.equal(botModeLabel("cnc", "reduce_only"), "Reduce only");
assert.equal(botModeLabel("dca", "stop_adding"), "Stop adding");
assert.equal(paperBotPair(), "Carry");
assert.equal(botPairBaseCoin("TRXUSDT"), "TRX");
assert.equal(botPairBaseCoin("1000PEPEUSDT"), "1000PEPE");
assert.equal(botPairBaseCoin("BTC"), "BTC");

const paper = paperConfigToFormValues({
  enabled: false,
  layers: [
    {
      ...defaultPaperLayer(0),
      id: 4,
      name: "Carry A",
      minNetApr: 0.12,
      minDte: 10,
      maxDte: 40,
      sizeType: "fixed",
      notionalUsdt: 2500,
      maxOpenCount: 3,
    },
  ],
}).layers[0]!;
assert.equal(paperBotSummary(paper), "Min APR 12% · DTE 10–40 · 2500 USDT · Max 3");

const perps = {
  ...defaultFuturesAutomationForm(0, "ETHUSDT"),
  formAction: "sell" as const,
  entrySource: "indicator" as const,
  orderType: "market" as const,
  size: "0.5",
  sizeUnit: "qty" as const,
};
assert.equal(perpsBotPair(perps), "ETHUSDT · Short");
assert.equal(perpsBotSummary(perps), "Short · Indicator · market · 0.5");

const playbook = {
  symbol: "BTCUSDT",
  direction: "both",
  startKind: "price",
  maxClips: 5,
  dipPct: 2,
  long: { status: "armed" },
  short: { status: "idle" },
} as unknown as DcaPlaybook;
assert.equal(dcaBotPair(playbook), "BTCUSDT · Both");
assert.equal(dcaBotSummary(playbook), "Price · 5 clips · 2% dip");
assert.equal(dcaListStatus(playbook), "Active");

const futuresOpen = [
  {
    ruleId: "rule-1",
    ruleName: "A",
    symbol: "BTCUSDT",
    side: "long",
    source: "engine",
  },
  {
    ruleId: "rule-2",
    ruleName: "B",
    symbol: "ETHUSDT",
    side: "short",
    source: "engine",
  },
];
const futuresClosed = [
  {
    ruleId: "rule-1",
    ruleName: "A",
    symbol: "BTCUSDT",
    side: "long",
    source: "engine",
    realizedUsdt: 20,
    notionalUsdt: 100,
    leverage: 10,
    openedAtMs: 1,
    closedAtMs: 2,
  },
];
assert.deepEqual(
  futuresAutomationsBotBlotter("rule-1", futuresOpen, futuresClosed),
  { positionCount: 1, roePct: 2 },
);
assert.deepEqual(
  futuresAutomationsBotBlotter("rule-2", futuresOpen, futuresClosed),
  { positionCount: 1, roePct: null },
);

const paperOpen = [
  {
    ruleId: 4,
    baseCoin: "BTC",
    spotSymbol: "BTCUSDT",
    futureSymbol: "BTCUSDT-26",
    notionalUsdt: 2500,
  },
];
const paperClosed = [
  {
    ruleId: 4,
    baseCoin: "BTC",
    spotSymbol: "BTCUSDT",
    futureSymbol: "BTCUSDT-26",
    notionalUsdt: 100,
    realizedUsdt: 5,
  },
  {
    ruleId: 9,
    baseCoin: "ETH",
    spotSymbol: "ETHUSDT",
    futureSymbol: "ETHUSDT-26",
    notionalUsdt: 100,
    realizedUsdt: 10,
  },
];
assert.deepEqual(paperAutomationsBotBlotter("4", paperOpen, paperClosed), {
  positionCount: 1,
  roePct: 0.05,
});
assert.deepEqual(paperAutomationsBotBlotter("9", paperOpen, paperClosed), {
  positionCount: 0,
  roePct: 0.1,
});
assert.deepEqual(
  paperAutomationsBotBlotter("4", paperOpen, [
    ...paperClosed,
    {
      ruleId: null,
      baseCoin: "BTC",
      spotSymbol: "BTCUSDT",
      futureSymbol: "BTCUSDT-26",
      notionalUsdt: 100,
      realizedUsdt: 50,
    },
  ]),
  { positionCount: 1, roePct: 0.05 },
);
assert.deepEqual(
  futuresAutomationsBotBlotter(
    "pb-new",
    [],
    [
      {
        ruleId: null,
        ruleName: "Old bot",
        symbol: "BTCUSDT",
        side: "long",
        source: "engine",
        realizedUsdt: 20,
        notionalUsdt: 100,
        leverage: 10,
        openedAtMs: 1,
        closedAtMs: 2,
      },
    ],
    [{ id: "pb-new", name: "Old bot", symbol: "BTCUSDT", direction: "both" }],
  ),
  { positionCount: 0, roePct: 2 },
);
assert.deepEqual(
  futuresAutomationsBotBlotter(
    "pb-new",
    [],
    [
      {
        ruleId: null,
        ruleName: "Retired bot",
        symbol: "BTCUSDT",
        side: "long",
        source: "engine",
        realizedUsdt: 20,
        notionalUsdt: 100,
        leverage: 10,
        openedAtMs: 1,
        closedAtMs: 2,
      },
    ],
    [{ id: "pb-new", name: "Old bot", symbol: "BTCUSDT", direction: "both" }],
  ),
  { positionCount: 0, roePct: null },
);

assert.equal(
  automationsBotBlotterHref("/strategies/futures/positions", "desk-1", "pb-1"),
  "/strategies/futures/positions?desk=desk-1&bot=pb-1&from=bots&focus=pb-1",
);
assert.deepEqual(
  automationsBotBlotterCells(
    "pb-1",
    { "pb-1": { positionCount: 2, roePct: 0.14 } },
    "/strategies/futures/positions",
    "/strategies/futures/performance",
    "/strategies/futures/activity",
    "desk-1",
  ),
  {
    positionCount: 2,
    roePct: 0.14,
    positionsHref:
      "/strategies/futures/positions?desk=desk-1&bot=pb-1&from=bots&focus=pb-1",
    performanceHref:
      "/strategies/futures/performance?desk=desk-1&bot=pb-1&from=bots&focus=pb-1",
    activityHref:
      "/strategies/futures/activity?desk=desk-1&bot=pb-1&from=bots&focus=pb-1",
  },
);

const alpha = {
  name: "Alpha",
  pair: "ETHUSDT · Long",
  status: "Disabled",
  summary: "Price",
  positionCount: 2,
  roePct: 0.1,
};
const beta = {
  name: "Beta",
  pair: "BTCUSDT · Short",
  status: "Active",
  summary: "Signal",
  positionCount: 0,
  roePct: null,
};
assert.ok(compareAutomationsBot(alpha, beta, "name", "asc") < 0);
assert.ok(compareAutomationsBot(alpha, beta, "pair", "asc") > 0);
assert.ok(compareAutomationsBot(alpha, beta, "status", "asc") > 0);
assert.ok(compareAutomationsBot(alpha, beta, "recipe", "asc") < 0);
assert.ok(compareAutomationsBot(alpha, beta, "positions", "desc") < 0);
assert.ok(compareAutomationsBot(alpha, beta, "performance", "asc") < 0);
assert.ok(compareAutomationsBot(beta, alpha, "performance", "asc") > 0);

const filterRows = [
  { ...alpha, statusKey: "disabled" },
  { ...beta, statusKey: "active" },
  {
    name: "Gamma",
    pair: "SOLUSDT · Both",
    status: "Stop adding",
    statusKey: "stop_adding",
    summary: "Immediate",
    positionCount: 1,
    roePct: 0,
  },
];
assert.equal(automationsBotFiltersActive({ q: "", pair: "", status: "" }), false);
assert.equal(automationsBotFiltersActive({ q: " ", pair: "", status: "" }), false);
assert.equal(automationsBotFiltersActive({ q: "", pair: "btc", status: "" }), true);
assert.deepEqual(
  filterAutomationsBots(filterRows, { q: "", pair: "", status: "" }).map(
    (row) => row.name,
  ),
  ["Alpha", "Beta", "Gamma"],
);
assert.deepEqual(
  filterAutomationsBots(filterRows, { q: "alp", pair: "", status: "" }).map(
    (row) => row.name,
  ),
  ["Alpha"],
);
assert.deepEqual(
  filterAutomationsBots(filterRows, { q: "", pair: "long", status: "" }).map(
    (row) => row.name,
  ),
  ["Alpha"],
);
assert.deepEqual(
  filterAutomationsBots(filterRows, { q: "", pair: "sol", status: "stop_adding" }).map(
    (row) => row.name,
  ),
  ["Gamma"],
);
assert.deepEqual(
  filterAutomationsBots(filterRows, { q: "beta", pair: "eth", status: "" }),
  [],
);
assert.deepEqual(
  filterAutomationsBots(
    [{ name: "", pair: "Carry", status: "Active" }],
    { q: "bot", pair: "", status: "Active" },
  ).map((row) => row.pair),
  ["Carry"],
);

const bots = [
  { id: "pb-1", name: "Add 1 ATR" },
  { id: "pb-2", name: "" },
];
assert.equal(
  focusedBotTitle("Current Positions", bots, "pb-1", "pb-1"),
  "Current Positions - Add 1 ATR",
);
assert.equal(
  focusedBotTitle("Desk Statistics", bots, "pb-2", "pb-2"),
  "Desk Statistics - Bot",
);
assert.equal(
  focusedBotTitle("Current Positions", bots, "", "pb-1"),
  "Current Positions",
);
assert.equal(
  focusedBotTitle("Current Positions", bots, "pb-2", "pb-1"),
  "Current Positions",
);
const arrived = automationsBotReturn(
  { from: "bots", focus: "pb-1", bot: "pb-1" },
  bots,
  "pb-1",
  "/strategies/futures/automations",
  "desk-1",
);
assert.equal(arrived.backHref, "/strategies/futures/automations?desk=desk-1");
assert.deepEqual(arrived.keep, { from: "bots", focus: "pb-1" });
assert.equal(arrived.titleFor("Current Positions"), "Current Positions - Add 1 ATR");
const switched = automationsBotReturn(
  { from: "bots", focus: "pb-1", bot: "pb-2" },
  bots,
  "pb-2",
  "/strategies/futures/automations",
  "desk-1",
);
assert.equal(switched.backHref, "/strategies/futures/automations?desk=desk-1");
assert.equal(switched.titleFor("Current Positions"), "Current Positions");
assert.equal(
  automationsBotReturn(null, bots, "", "/strategies/futures/automations", "desk-1")
    .backHref,
  null,
);
assert.equal(
  automationsReturnHref(
    "/strategies/futures/positions",
    "desk-1",
    { from: "bots", focus: "pb-1" },
  ),
  "/strategies/futures/positions?desk=desk-1&from=bots&focus=pb-1",
);
assert.equal(
  automationsReturnHref("/strategies/futures/positions", "desk-1", {}),
  "/strategies/futures/positions?desk=desk-1",
);

const savedView = {
  filters: { q: "atr", pair: "og", status: "active" },
  sortKey: "performance",
  sortDir: "desc" as const,
  page: 3,
  scrollY: 840,
};
assert.equal(
  automationsListViewKey("/strategies/futures/automations", "desk-1"),
  "tbp-automations-list:/strategies/futures/automations:desk-1",
);
assert.deepEqual(
  parseAutomationsListView(serializeAutomationsListView(savedView)),
  savedView,
);
assert.equal(parseAutomationsListView("{"), null);
assert.equal(
  parseAutomationsListView(
    JSON.stringify({ ...savedView, sortKey: "missing" }),
  ),
  null,
);
assert.equal(
  parseAutomationsListView(JSON.stringify({ ...savedView, page: 0 })),
  null,
);

const flexSnap = snapshotPerpsRecipe({
  name: "Flex Entry — ATR band",
  symbol: "BCHUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "usdt",
  size: 25000,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 264,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
  exitActions: [
    {
      id: "tp",
      kind: "take_profit",
      scope: { kind: "all" },
      groups: [],
      takeProfitPct: 3,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
    },
  ],
  direction: "long",
  shortEntry: null,
});
const flexRule = perpsRecipeToRule(flexSnap, { sortOrder: 0 });
assert.equal(flexRule.ok, true);
if (flexRule.ok) {
  const listed = perpsListRecipe(futuresRuleToForm(flexRule.rule));
  const saved = snapshotPerpsRecipe(flexRule.rule);
  assert.deepEqual(listed, saved);
  const parsedListed = parseListedRecipe(listed);
  const parsedSaved = parseListedRecipe(saved);
  assert.equal(parsedListed?.kind, "flex");
  assert.ok(parsedListed && parsedSaved);
  if (parsedListed && parsedSaved) {
    assert.equal(recipesMatchReplayFields(parsedListed, parsedSaved), true);
  }
  const exit = templateParamSections(listed).find(
    (section) => section.title === "Long Exit Conditions",
  );
  assert.equal(exit?.stacks?.[0]?.title, "Take profit");
  assert.equal(
    templateParamSections(listed).some((section) =>
      section.groups.some((group) =>
        group.rows.some((row) => row.label === "Name"),
      ),
    ),
    false,
  );
}

const carry = {
  ...defaultPaperLayer(0),
  name: "Carry core",
  minNetApr: 0.12,
  takeProfitPct: 0.04,
  stopLossPct: -0.02,
};
const carryForm = paperConfigToFormValues({
  enabled: true,
  layers: [carry],
}).layers[0];
assert.ok(carryForm);
if (carryForm) {
  const listed = paperListRecipe(carryForm);
  assert.deepEqual(listed, snapshotPaperRecipe(carry));
  assert.equal(listed ? parseListedRecipe(listed)?.kind : null, "cash_and_carry");
}
