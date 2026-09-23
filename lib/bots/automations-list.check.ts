import assert from "node:assert/strict";
import {
  automationsBotBlotterCells,
  automationsBotFiltersActive,
  botModeLabel,
  compareAutomationsBot,
  dcaBotPair,
  dcaBotSummary,
  dcaListStatus,
  filterAutomationsBots,
  futuresAutomationsBotBlotter,
  paperAutomationsBotBlotter,
  paperBotPair,
  paperBotSummary,
  perpsBotPair,
  perpsBotSummary,
} from "./automations-list";
import { automationsBotBlotterHref } from "./automations-path";
import { defaultFuturesAutomationForm } from "@/lib/futures/automation";
import { paperConfigToFormValues, defaultPaperLayer } from "@/lib/engine/rules";
import type { DcaPlaybook } from "@/lib/dca/playbook";

assert.equal(botModeLabel("cnc", "reduce_only"), "Reduce only");
assert.equal(botModeLabel("dca", "stop_adding"), "Stop adding");
assert.equal(paperBotPair(), "Carry");

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
  "/strategies/futures/positions?desk=desk-1&bot=pb-1",
);
assert.deepEqual(
  automationsBotBlotterCells(
    "pb-1",
    { "pb-1": { positionCount: 2, roePct: 0.14 } },
    "/strategies/futures/positions",
    "/strategies/futures/performance",
    "desk-1",
  ),
  {
    positionCount: 2,
    roePct: 0.14,
    positionsHref: "/strategies/futures/positions?desk=desk-1&bot=pb-1",
    performanceHref: "/strategies/futures/performance?desk=desk-1&bot=pb-1",
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
