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
  missingById,
  futuresAutomationsBotBlotter,
  paperAutomationsBotBlotter,
  paperBotPair,
  paperBotSummary,
  perpsBotPair,
  perpsBotSummary,
} from "./automations-list";
import {
  automationsBotBlotterHref,
  automationsBotReturn,
  automationsReturnHref,
  focusedBotTitle,
} from "./automations-path";
import { defaultFuturesAutomationForm } from "@/lib/futures/automation";
import { paperConfigToFormValues, defaultPaperLayer } from "@/lib/engine/rules";
import type { DcaPlaybook } from "@/lib/dca/playbook";

assert.deepEqual(
  missingById(new Set(["a"]), [{ id: "a" }, { id: "b" }, { id: "" }]).map(
    (row) => row.id,
  ),
  ["b"],
);

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
assert.equal(perpsBotPair(perps), "ETHUSDT · Sell");
assert.equal(perpsBotSummary(perps), "Sell · Indicator · market · 0.5");

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
