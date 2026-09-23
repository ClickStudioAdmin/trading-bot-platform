import assert from "node:assert/strict";
import {
  DESK_BLOTTER_ALL_BOTS_LABEL,
  blotterFiltersForCopyDesk,
  deskBlotterFiltersActive,
  filterFuturesBlotterRows,
  filterFuturesWorkingRows,
  filterPaperBlotterRows,
  matchDeskBlotterRow,
  parseDeskBlotterFilters,
  resolveFuturesRowBotId,
} from "./desk-blotter-filters";

assert.equal(DESK_BLOTTER_ALL_BOTS_LABEL, "Desk Wide (all bots)");

assert.deepEqual(parseDeskBlotterFilters({}), {
  bot: "",
  pair: "",
  side: "",
});
assert.deepEqual(
  parseDeskBlotterFilters({ bot: " pb-1 ", pair: "BTC", side: "LONG" }),
  { bot: "pb-1", pair: "BTC", side: "long" },
);
assert.equal(parseDeskBlotterFilters({ side: "both" }).side, "");
assert.equal(deskBlotterFiltersActive({ bot: "", pair: "", side: "" }), false);
assert.equal(deskBlotterFiltersActive({ bot: "pb-1", pair: "", side: "" }), true);
const scoped = { bot: "pb-1", pair: "BTC", side: "long" as const };
assert.equal(blotterFiltersForCopyDesk(scoped, false), scoped);
assert.deepEqual(blotterFiltersForCopyDesk(scoped, true), {
  bot: "",
  pair: "BTC",
  side: "long",
});
assert.equal(
  blotterFiltersForCopyDesk({ bot: "", pair: "", side: "" }, true).bot,
  "",
);

const row = { botId: "rule-9", pair: "BTCUSDT · Buy", side: "long" };
assert.equal(matchDeskBlotterRow(row, { bot: "", pair: "", side: "" }), true);
assert.equal(matchDeskBlotterRow(row, { bot: "rule-9", pair: "btc", side: "long" }), true);
assert.equal(matchDeskBlotterRow(row, { bot: "other", pair: "", side: "" }), false);
assert.equal(matchDeskBlotterRow(row, { bot: "", pair: "ETH", side: "" }), false);
assert.equal(matchDeskBlotterRow(row, { bot: "", pair: "", side: "short" }), false);
assert.equal(
  matchDeskBlotterRow({ botId: null, pair: "BTCUSDT", side: "long" }, {
    bot: "pb-1",
    pair: "",
    side: "",
  }),
  false,
);

const playbooks = [
  { id: "pb-doge", name: "Doge bot", symbol: "DOGEUSDT", direction: "both" },
];
assert.equal(
  resolveFuturesRowBotId(
    {
      ruleId: "rule-1",
      ruleName: null,
      symbol: "BTCUSDT",
      side: "long",
      source: "engine",
    },
    playbooks,
  ),
  "rule-1",
);
assert.equal(
  resolveFuturesRowBotId(
    {
      ruleId: null,
      ruleName: "Doge bot",
      symbol: "DOGEUSDT",
      side: "short",
      source: "engine",
    },
    playbooks,
    "hint-id",
  ),
  "hint-id",
);
assert.equal(
  resolveFuturesRowBotId(
    {
      ruleId: null,
      ruleName: "Doge bot",
      symbol: "DOGEUSDT",
      side: "long",
      source: "engine",
    },
    playbooks,
  ),
  "pb-doge",
);
assert.equal(
  resolveFuturesRowBotId(
    {
      ruleId: null,
      ruleName: null,
      symbol: "DOGEUSDT",
      side: "long",
      source: "manual",
    },
    playbooks,
  ),
  null,
);
assert.equal(
  resolveFuturesRowBotId(
    {
      ruleId: null,
      ruleName: "Doge bot",
      symbol: "DOGEUSDT",
      side: "long",
      source: "engine",
    },
    playbooks,
    "hint-id",
    { inferBot: false },
  ),
  null,
);

assert.equal(
  filterFuturesBlotterRows(
    [
      {
        ruleId: "rule-9",
        ruleName: "Rule 1",
        symbol: "BTCUSDT",
        side: "long",
        source: "engine",
      },
      {
        ruleId: null,
        ruleName: null,
        symbol: "ETHUSDT",
        side: "short",
        source: "manual",
      },
    ],
    { bot: "rule-9", pair: "", side: "" },
  ).map((row) => row.symbol).join(","),
  "BTCUSDT",
);
assert.equal(
  filterFuturesWorkingRows(
    [
      {
        symbol: "BTCUSDT",
        side: "long",
        source: "engine",
        ruleName: "Doge bot",
      },
      {
        symbol: "ETHUSDT",
        side: "short",
        source: "manual",
        ruleName: null,
      },
    ],
    { bot: "", pair: "eth", side: "" },
  )
    .map((row) => row.symbol)
    .join(","),
  "ETHUSDT",
);
assert.equal(
  filterFuturesWorkingRows(
    [
      {
        symbol: "DOGEUSDT",
        side: "long",
        source: "engine",
        ruleName: "Doge bot",
      },
    ],
    { bot: "pb-doge", pair: "", side: "" },
    playbooks,
  ).length,
  1,
);

assert.equal(
  filterPaperBlotterRows(
    [
      {
        ruleId: 3,
        baseCoin: "BTC",
        spotSymbol: "BTCUSDT",
        futureSymbol: "BTCUSDH26",
      },
      {
        ruleId: 4,
        baseCoin: "ETH",
        spotSymbol: "ETHUSDT",
        futureSymbol: "ETHUSDH26",
      },
    ],
    { bot: "3", pair: "", side: "" },
  ).map((row) => row.baseCoin).join(","),
  "BTC",
);
assert.equal(
  filterPaperBlotterRows(
    [
      {
        ruleId: null,
        baseCoin: "BTC",
        spotSymbol: "BTCUSDT",
        futureSymbol: "BTCUSDH26",
      },
    ],
    { bot: "3", pair: "", side: "" },
  ).length,
  0,
);

console.log("desk-blotter-filters checks passed");
