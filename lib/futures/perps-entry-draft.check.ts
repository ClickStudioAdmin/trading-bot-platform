import assert from "node:assert/strict";
import { entryRowsMissing } from "@/components/entry-condition-stack";
import {
  initialPerpsEntryDrafts,
  perpsEntryDraftMissing,
} from "@/components/perps-entry-panel";
import {
  indicatorDraftMissing,
  indicatorFieldInvalid,
} from "@/lib/dca/indicators";
import { defaultFuturesAutomationForm } from "@/lib/futures/automation";

const fresh = initialPerpsEntryDrafts(defaultFuturesAutomationForm(0, "BTCUSDT"));
assert.equal(fresh.long.entrySource, "");
assert.equal(fresh.short.entrySource, "");
assert.deepEqual(fresh.short.entryRows, []);
assert.equal(fresh.short.triggerPrice, "");

const long = defaultFuturesAutomationForm(0, "BTCUSDT");
long.id = "rule-1";
long.entrySource = "price";
long.triggerCompare = "gte";
long.triggerPrice = "100";
const openedLong = initialPerpsEntryDrafts(long);
assert.equal(openedLong.long.entrySource, "price");
assert.equal(openedLong.long.triggerCompare, "gte");
assert.equal(openedLong.long.triggerPrice, "100");
assert.equal(openedLong.short.entrySource, "");
assert.equal(openedLong.short.triggerPrice, "");
assert.deepEqual(openedLong.short.entryRows, []);
assert.notEqual(openedLong.short.triggerCompare, openedLong.long.triggerCompare);

const short = defaultFuturesAutomationForm(0, "BTCUSDT");
short.id = "rule-2";
short.formAction = "sell";
short.entrySource = "indicator";
short.indicator = {
  kind: "rsi",
  timeframe: "15",
  compare: "cross_lte",
  level: 25,
  period: 14,
  slowPeriod: null,
};
const openedShort = initialPerpsEntryDrafts(short);
assert.equal(openedShort.short.entrySource, "indicator");
assert.equal(openedShort.short.indicatorCompare, "cross_lte");
assert.equal(openedShort.short.indicatorLevel, "25");
assert.equal(openedShort.long.entrySource, "");
assert.equal(openedShort.long.indicatorLevel, "30");
assert.notEqual(openedShort.long.indicatorLevel, "75");

const both = defaultFuturesAutomationForm(0, "BTCUSDT");
both.id = "rule-3";
both.direction = "both";
both.entrySource = "price";
both.triggerCompare = "gte";
both.triggerPrice = "110";
both.shortEntry = {
  entrySource: "price",
  webhookId: null,
  triggerBy: "last",
  triggerCompare: "lte",
  triggerPrice: 90,
  skipIfOpen: true,
  indicator: null,
  confirm: null,
  entryStack: both.entryStack,
};
const openedBoth = initialPerpsEntryDrafts(both);
assert.equal(openedBoth.long.triggerPrice, "110");
assert.equal(openedBoth.long.triggerCompare, "gte");
assert.equal(openedBoth.short.triggerPrice, "90");
assert.equal(openedBoth.short.triggerCompare, "lte");

const bothRetrace = defaultFuturesAutomationForm(0, "SOLUSDT");
bothRetrace.id = "rule-4";
bothRetrace.direction = "both";
bothRetrace.entrySource = "retrace";
bothRetrace.retrace = {
  source: "last",
  from: "high",
  pct: 5,
  lookback: 20,
  timeframe: "60",
};
bothRetrace.shortEntry = {
  entrySource: "retrace",
  webhookId: null,
  triggerBy: "last",
  triggerCompare: "lte",
  triggerPrice: 0,
  skipIfOpen: true,
  indicator: null,
  confirm: null,
  entryStack: { leaves: [], joins: [] },
  retrace: {
    source: "last",
    from: "low",
    pct: 3,
    lookback: 20,
    timeframe: "15",
  },
};
const openedRetrace = initialPerpsEntryDrafts(bothRetrace);
assert.equal(openedRetrace.long.retracePct, "5");
assert.equal(openedRetrace.long.retraceFrom, "high");
assert.equal(openedRetrace.long.retraceTimeframe, "60");
assert.equal(openedRetrace.short.entrySource, "retrace");
assert.equal(openedRetrace.short.retracePct, "3");
assert.equal(openedRetrace.short.retraceFrom, "low");
assert.equal(openedRetrace.short.retraceSource, "last");
assert.equal(openedRetrace.short.retraceLookback, "20");
assert.equal(openedRetrace.short.retraceTimeframe, "15");
assert.equal(perpsEntryDraftMissing(openedRetrace.short, false), false);

assert.equal(perpsEntryDraftMissing(fresh.long, false), true);
const priced = { ...openedLong.long, triggerPrice: "" };
assert.equal(perpsEntryDraftMissing(priced, false), true);
const webhook = { ...openedLong.long, entrySource: "webhook" as const, webhookId: "" };
assert.equal(perpsEntryDraftMissing(webhook, false), true);
assert.equal(
  indicatorDraftMissing({
    family: "indicator",
    kind: "rsi",
    compare: "cross_lte",
    level: "",
    period: "14",
    slowPeriod: "",
    multiplier: "3",
  }),
  true,
);
assert.equal(
  indicatorDraftMissing({
    family: "indicator",
    kind: "rsi",
    compare: "cross_lte",
    level: "30",
    period: "",
    slowPeriod: "",
    multiplier: "3",
  }),
  true,
);
assert.equal(perpsEntryDraftMissing(openedLong.long, false), false);
assert.equal(
  perpsEntryDraftMissing(
    {
      ...openedLong.long,
      entryRows: [{ key: "extra", join: "and", draft: { kind: "unset" } }],
    },
    false,
  ),
  false,
);
assert.equal(
  entryRowsMissing([{ draft: { kind: "unset" } }]),
  false,
);
assert.equal(
  entryRowsMissing([
    { draft: { kind: "price", triggerBy: "last", compare: "gte", price: "" } },
  ]),
  true,
);
assert.equal(
  perpsEntryDraftMissing(
    {
      ...openedLong.long,
      entryRows: [
        {
          key: "extra",
          join: "and",
          draft: { kind: "price", triggerBy: "last", compare: "gte", price: "" },
        },
      ],
    },
    false,
  ),
  true,
);

const blankIndicator = {
  family: "indicator" as const,
  kind: "",
  compare: "cross_lte",
  level: "",
  period: "14",
  slowPeriod: "",
  multiplier: "3",
};
assert.equal(indicatorFieldInvalid(blankIndicator, "kind"), true);
assert.equal(
  indicatorFieldInvalid({ ...blankIndicator, kind: "rsi", level: "" }, "level"),
  true,
);
assert.equal(
  indicatorFieldInvalid(
    { ...blankIndicator, kind: "rsi", level: "30", period: "14" },
    "period",
  ),
  false,
);
assert.equal(
  indicatorFieldInvalid(
    {
      family: "trend",
      kind: "supertrend",
      compare: "flip_up",
      level: "",
      period: "1",
      slowPeriod: "",
      multiplier: "3",
    },
    "period",
  ),
  true,
);

console.log("perps entry draft checks passed");
