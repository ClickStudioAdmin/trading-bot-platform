import assert from "node:assert/strict";
import {
  initialPerpsEntryDrafts,
  perpsEntryDraftMissing,
} from "@/components/perps-entry-panel";
import { indicatorDraftMissing } from "@/lib/dca/indicators";
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

console.log("perps entry draft checks passed");
