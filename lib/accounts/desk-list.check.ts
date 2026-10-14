import assert from "node:assert/strict";
import {
  buildDeskListRow,
  compareDeskList,
  dcaLegStatusesOn,
  deskDetailLines,
  deskExchangeView,
  deskListFilterChoices,
  deskListFiltersActive,
  deskListStatus,
  EMPTY_DESK_LIST_FILTERS,
  filterDeskList,
  formatDeskListStatus,
  type DeskListRow,
} from "@/lib/accounts/desk-list";
import type { TradingAccount } from "@/lib/accounts/model";
import type { ExchangeConnection } from "@/lib/exchanges/connections";

assert.equal(dcaLegStatusesOn("armed", "idle"), true);
assert.equal(dcaLegStatusesOn("idle", "stop_adding"), true);
assert.equal(dcaLegStatusesOn("closing", "idle"), false);
assert.equal(dcaLegStatusesOn("idle", "idle"), false);

assert.deepEqual(deskDetailLines({ openCount: 0, botCount: 0, workingCount: 0 }), [
  "0 Bots",
  "0 Open positions",
  "0 Open orders",
]);
assert.deepEqual(deskDetailLines({ openCount: 1, botCount: 1, workingCount: 1 }), [
  "1 Bot",
  "1 Open position",
  "1 Open order",
]);
assert.deepEqual(deskDetailLines({ openCount: 2, botCount: 488, workingCount: 3 }), [
  "488 Bots",
  "2 Open positions",
  "3 Open orders",
]);

assert.equal(deskListStatus(0), "inactive");
assert.equal(deskListStatus(1), "active");
assert.equal(formatDeskListStatus("active"), "Active");
assert.equal(formatDeskListStatus("inactive"), "Inactive");

assert.deepEqual(
  deskExchangeView(
    { mode: "paper", venue: "bybit", venueEnvironment: null },
    null,
  ),
  {
    exchange: "Bybit",
    connection: null,
    environment: "Paper",
    environmentTitle: null,
  },
);
assert.deepEqual(
  deskExchangeView(
    { mode: "live", venue: "bybit", venueEnvironment: "demo" },
    { label: "Main Demo Account", venue: "bybit", environment: "demo" },
  ),
  {
    exchange: "Bybit",
    connection: "Main Demo Account",
    environment: "Demo",
    environmentTitle: null,
  },
);
assert.deepEqual(
  deskExchangeView(
    { mode: "live", venue: "bybit", venueEnvironment: "demo" },
    { label: "Bybit", venue: "bybit", environment: "demo" },
  ),
  { exchange: "Bybit", connection: null, environment: "Demo", environmentTitle: null },
);
assert.deepEqual(
  deskExchangeView(
    { mode: "live", venue: "hyperliquid", venueEnvironment: "testnet" },
    {
      label: "Hyper - Test Agent",
      venue: "hyperliquid",
      environment: "testnet",
    },
  ),
  {
    exchange: "Hyperliquid",
    connection: "Hyper - Test Agent",
    environment: "Demo",
    environmentTitle: "Hyperliquid Testnet",
  },
);
assert.deepEqual(
  deskExchangeView(
    { mode: "live", venue: "bybit", venueEnvironment: "demo" },
    null,
  ),
  { exchange: null, connection: null, environment: "Demo", environmentTitle: null },
);

function account(
  partial: Pick<TradingAccount, "id" | "name" | "deskType" | "mode"> &
    Partial<TradingAccount>,
): TradingAccount {
  return {
    userId: "member",
    venue: "bybit",
    venueEnvironment: partial.mode === "paper" ? null : "demo",
    copyOfAccountId: null,
    createdAtMs: 0,
    ...partial,
  };
}

const connection: ExchangeConnection = {
  id: "conn-1",
  userId: "member",
  venue: "bybit",
  environment: "demo",
  label: "Main Demo Account",
  fingerprint: "abcd",
  venueAccountId: null,
  status: "active",
  verifiedAtMs: null,
  createdAtMs: 0,
};

function row(
  desk: TradingAccount,
  usage: {
    openCount?: number;
    botCount?: number;
    workingCount?: number;
    botsOn?: number;
    connectionId?: string | null;
  },
): DeskListRow {
  return buildDeskListRow(
    desk,
    {
      openCount: usage.openCount ?? 0,
      botCount: usage.botCount ?? 0,
      workingCount: usage.workingCount ?? 0,
      botsOn: usage.botsOn ?? 0,
      futuresConnectionId: usage.connectionId ?? null,
      strategyConnectionId: null,
      blocks: [],
    },
    usage.connectionId ? [connection] : [],
  );
}

const cloud = row(
  account({
    id: "cloud",
    name: "Bot Monitoring - Cloud",
    deskType: "dca",
    mode: "live",
  }),
  { openCount: 1, botCount: 488, workingCount: 2, botsOn: 12, connectionId: "conn-1" },
);
const paper = row(
  account({
    id: "paper",
    name: "ByBit Paper",
    deskType: "dca",
    mode: "paper",
    venueEnvironment: null,
  }),
  { botCount: 4, botsOn: 2 },
);
const manual = row(
  account({
    id: "manual",
    name: "ByBit",
    deskType: "perps",
    mode: "live",
    venueEnvironment: null,
  }),
  {},
);
const rows = [cloud, paper, manual];

assert.equal(cloud.status, "active");
assert.equal(cloud.exchange, "Bybit");
assert.equal(cloud.connection, "Main Demo Account");
assert.equal(cloud.environment, "Demo");
assert.deepEqual(cloud.detailLines, [
  "488 Bots",
  "1 Open position",
  "2 Open orders",
]);
assert.equal(paper.environment, "Paper");
assert.equal(manual.status, "inactive");
assert.equal(manual.exchange, null);
assert.equal(manual.environment, null);

assert.deepEqual(
  filterDeskList(rows, { ...EMPTY_DESK_LIST_FILTERS, name: "cloud" }).map(
    (item) => item.account.id,
  ),
  ["cloud"],
);
assert.deepEqual(
  filterDeskList(rows, { ...EMPTY_DESK_LIST_FILTERS, type: "perps" }).map(
    (item) => item.account.id,
  ),
  ["manual"],
);
assert.deepEqual(
  filterDeskList(rows, { ...EMPTY_DESK_LIST_FILTERS, mode: "paper" }).map(
    (item) => item.account.id,
  ),
  ["paper"],
);
assert.deepEqual(
  filterDeskList(rows, {
    ...EMPTY_DESK_LIST_FILTERS,
    exchange: "Bybit",
  }).map((item) => item.account.id),
  ["cloud", "paper"],
);
assert.deepEqual(
  filterDeskList(rows, { ...EMPTY_DESK_LIST_FILTERS, environment: "Paper" }).map(
    (item) => item.account.id,
  ),
  ["paper"],
);
assert.deepEqual(
  filterDeskList(rows, { ...EMPTY_DESK_LIST_FILTERS, status: "inactive" }).map(
    (item) => item.account.id,
  ),
  ["manual"],
);
assert.deepEqual(
  filterDeskList(rows, {
    ...EMPTY_DESK_LIST_FILTERS,
    type: "dca",
    status: "active",
    mode: "paper",
  }).map((item) => item.account.id),
  ["paper"],
);
assert.equal(deskListFiltersActive(EMPTY_DESK_LIST_FILTERS), false);
assert.equal(
  deskListFiltersActive({ ...EMPTY_DESK_LIST_FILTERS, name: " " }),
  false,
);
assert.equal(
  deskListFiltersActive({ ...EMPTY_DESK_LIST_FILTERS, status: "active" }),
  true,
);

assert.deepEqual(deskListFilterChoices(rows).types, ["dca", "perps"]);
assert.deepEqual(deskListFilterChoices(rows).exchanges, ["—", "Bybit"]);
assert.deepEqual(deskListFilterChoices(rows).environments, ["—", "Demo", "Paper"]);

assert.ok(
  compareDeskList(cloud, paper, "details", "asc") > 0,
  "more bots sort after fewer when ascending",
);
const fewerBots = row(
  account({ id: "fewer", name: "Fewer", deskType: "dca", mode: "paper" }),
  { botCount: 2, openCount: 5, workingCount: 9 },
);
const moreBots = row(
  account({ id: "more", name: "More", deskType: "dca", mode: "paper" }),
  { botCount: 10, openCount: 0, workingCount: 0 },
);
assert.ok(
  compareDeskList(moreBots, fewerBots, "details", "asc") > 0,
  "bot count sorts ahead of open positions",
);
const sameBotsMorePositions = row(
  account({ id: "same-bots", name: "Same bots", deskType: "dca", mode: "paper" }),
  { botCount: 10, openCount: 3, workingCount: 0 },
);
assert.ok(
  compareDeskList(sameBotsMorePositions, moreBots, "details", "asc") > 0,
  "equal bots sort by open positions",
);
const sameCountsMoreOrders = row(
  account({ id: "orders", name: "Orders", deskType: "dca", mode: "paper" }),
  { botCount: 10, openCount: 0, workingCount: 2 },
);
assert.ok(
  compareDeskList(sameCountsMoreOrders, moreBots, "details", "asc") > 0,
  "equal bots and positions sort by open orders",
);
assert.ok(
  compareDeskList(cloud, paper, "exchange", "asc") > 0,
  "the same exchange sorts by connection name",
);
assert.equal(paper.exchange, "Bybit");
assert.equal(paper.connection, null);
assert.ok(compareDeskList(paper, manual, "status", "asc") < 0);

console.log("desk-list.check: ok");
