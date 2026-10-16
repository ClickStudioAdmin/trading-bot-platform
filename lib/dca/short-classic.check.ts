import assert from "node:assert/strict";
import { parseFuturesAutomationForm } from "@/lib/futures/automation";
import { perpsAutomationLegs } from "@/lib/futures/automation";
import {
  dcaClassicForSide,
  parseDcaPlaybookForm,
  type DcaPlaybookConfig,
} from "./playbook";

function dcaForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  form.set("name", "Both exits");
  form.set("symbol", "BTCUSDT");
  form.set("direction", "both");
  form.set("startKind", "immediate");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return form;
}

const split = parseDcaPlaybookForm(
  dcaForm({
    tpOn: "on",
    takeProfitKind: "percent",
    takeProfitPct: "5",
    takeProfitBasis: "average",
    takeProfitOrderType: "market",
    slOn: "on",
    stopLossPct: "9",
    stopLossBasis: "average",
    breakeven: "on",
    breakevenActivationPct: "3",
    breakevenOffsetPct: "1",
    trailOn: "on",
    trailingTriggerPct: "4",
    trailingPct: "2",
    shortClassic: "on",
    shortTpOn: "on",
    shortTakeProfitKind: "atr",
    shortTakeProfitAtrMult: "1.5",
    shortAtrPeriod: "20",
    shortTakeProfitBasis: "first_entry",
    shortTakeProfitOrderType: "limit",
    shortSlOn: "on",
    shortStopLossPct: "3",
    shortStopLossBasis: "first_entry",
    shortBreakeven: "on",
    shortBreakevenActivationPct: "6",
    shortBreakevenOffsetPct: "0.4",
    shortTrailOn: "on",
    shortTrailingTriggerPct: "8",
    shortTrailingPct: "1.1",
  }),
);
assert.equal(split.ok, true);
if (!split.ok) {
  throw new Error("expected a parsed both playbook");
}
assert.equal(split.config.takeProfitPct, 5);
assert.equal(split.config.stopLossPct, 9);
assert.equal(split.config.breakevenActivationPct, 3);
assert.equal(split.config.breakevenOffsetPct, 1);
assert.equal(split.config.trailingTriggerPct, 4);
assert.equal(split.config.trailingPct, 2);
const short = split.config.shortClassic;
assert.ok(short);
assert.equal(short.takeProfitKind, "atr");
assert.equal(short.takeProfitAtrMult, 1.5);
assert.equal(short.atrPeriod, 20);
assert.equal(short.takeProfitBasis, "first_entry");
assert.equal(short.takeProfitOrderType, "limit");
assert.equal(short.takeProfitPct, null);
assert.equal(short.stopLossPct, 3);
assert.equal(short.stopLossBasis, "first_entry");
assert.equal(short.breakevenActivationPct, 6);
assert.equal(short.breakevenOffsetPct, 0.4);
assert.equal(short.trailingTriggerPct, 8);
assert.equal(short.trailingPct, 1.1);

const longSide = dcaClassicForSide(split.config as DcaPlaybookConfig, "long");
const shortSide = dcaClassicForSide(split.config as DcaPlaybookConfig, "short");
assert.equal(longSide.stopLossPct, 9);
assert.equal(shortSide.stopLossPct, 3);
assert.equal(longSide.breakevenActivationPct, 3);
assert.equal(shortSide.breakevenActivationPct, 6);

const legacy = parseDcaPlaybookForm(
  dcaForm({
    tpOn: "on",
    takeProfitPct: "5",
    slOn: "on",
    stopLossPct: "9",
  }),
);
assert.equal(legacy.ok, true);
if (!legacy.ok) {
  throw new Error("expected a legacy both playbook");
}
assert.equal(legacy.config.shortClassic, null);
assert.equal(dcaClassicForSide(legacy.config as DcaPlaybookConfig, "short").stopLossPct, 9);
assert.equal(dcaClassicForSide(legacy.config as DcaPlaybookConfig, "short").takeProfitPct, 5);

const missingStop = parseDcaPlaybookForm(
  dcaForm({
    shortClassic: "on",
    shortSlOn: "on",
  }),
);
assert.equal(missingStop.ok, false);
if (missingStop.ok) {
  throw new Error("expected a short stop error");
}
assert.equal(missingStop.error, "Enter a short stop loss.");

const missingBreakeven = parseDcaPlaybookForm(
  dcaForm({
    shortClassic: "on",
    shortSlOn: "on",
    shortStopLossPct: "3",
    shortBreakeven: "on",
  }),
);
assert.equal(missingBreakeven.ok, false);
if (missingBreakeven.ok) {
  throw new Error("expected a short breakeven error");
}
assert.equal(missingBreakeven.error, "Enter a short breakeven activation percent.");

function perpsForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  form.set("deskVenue", "bybit");
  form.set("ruleCount", "1");
  form.set("r0_name", "Both exits");
  form.set("r0_mode", "disabled");
  form.set("r0_symbol", "BTCUSDT");
  form.set("r0_action", "buy");
  form.set("r0_direction", "both");
  form.set("r0_orderType", "market");
  form.set("r0_sizeUnit", "qty");
  form.set("r0_size", "1");
  form.set("r0_entrySource", "price");
  form.set("r0_triggerBy", "last");
  form.set("r0_triggerCompare", "gte");
  form.set("r0_triggerPrice", "100");
  form.set("r0_skipIfOpen", "on");
  form.set("r0_short_entrySource", "price");
  form.set("r0_short_triggerBy", "last");
  form.set("r0_short_triggerCompare", "lte");
  form.set("r0_short_triggerPrice", "90");
  form.set("r0_short_skipIfOpen", "on");
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return form;
}

const perps = parseFuturesAutomationForm(
  perpsForm({
    r0_tpsl: "on",
    r0_tpslMode: "full",
    r0_tpOn: "on",
    r0_takeProfit: "5",
    r0_tpKind: "percent",
    r0_tpTrigger: "last",
    r0_tpOrderType: "market",
    r0_slOn: "on",
    r0_stopLoss: "9",
    r0_slKind: "percent",
    r0_slTrigger: "mark",
    r0_slOrderType: "market",
    r0_breakeven: "on",
    r0_breakevenActivationPct: "3",
    r0_breakevenOffsetPct: "1",
    r0_trailing: "on",
    r0_trailingStop: "2",
    r0_trailingActivation: "on",
    r0_trailingActive: "110",
    r0_short_classic: "on",
    r0_short_tpsl: "on",
    r0_short_tpslMode: "full",
    r0_short_tpOn: "on",
    r0_short_takeProfit: "7",
    r0_short_tpKind: "price",
    r0_short_tpTrigger: "index",
    r0_short_tpOrderType: "limit",
    r0_short_tpLimitPrice: "80",
    r0_short_slOn: "on",
    r0_short_stopLoss: "3",
    r0_short_slKind: "price",
    r0_short_slTrigger: "last",
    r0_short_slOrderType: "limit",
    r0_short_slLimitPrice: "70",
    r0_short_breakeven: "on",
    r0_short_breakevenActivationPct: "6",
    r0_short_breakevenOffsetPct: "0.4",
    r0_short_trailing: "on",
    r0_short_trailingStop: "4",
    r0_short_trailingActivation: "on",
    r0_short_trailingActive: "95",
  }),
);
assert.equal(perps.ok, true);
if (!perps.ok) {
  throw new Error("expected a parsed both perps rule");
}
const rule = perps.rules[0];
assert.ok(rule);
assert.equal(rule.tpsl?.takeProfit, 5);
assert.equal(rule.tpsl?.stopLoss, 9);
assert.equal(rule.breakevenActivationPct, 3);
assert.equal(rule.trailing?.distance, 2);
assert.equal(rule.trailing?.activePrice, 110);
const classic = rule.shortEntry?.classic;
assert.ok(classic);
assert.equal(classic.tpsl?.takeProfit, 7);
assert.equal(classic.tpsl?.tpKind, "price");
assert.equal(classic.tpsl?.tpTrigger, "index");
assert.equal(classic.tpsl?.tpOrderType, "limit");
assert.equal(classic.tpsl?.tpLimitPrice, 80);
assert.equal(classic.tpsl?.stopLoss, 3);
assert.equal(classic.tpsl?.slOrderType, "limit");
assert.equal(classic.tpsl?.slLimitPrice, 70);
assert.equal(classic.breakevenActivationPct, 6);
assert.equal(classic.breakevenOffsetPct, 0.4);
assert.equal(classic.trailing?.distance, 4);
assert.equal(classic.trailing?.activePrice, 95);

const legs = perpsAutomationLegs(rule);
const shortLeg = legs.find((leg) => leg.side === "short");
assert.equal(shortLeg?.rule.tpsl?.stopLoss, 3);
assert.equal(shortLeg?.rule.tpsl?.takeProfit, 7);
assert.equal(shortLeg?.rule.breakevenActivationPct, 6);
assert.equal(legs.find((leg) => leg.side === "long")?.rule.tpsl?.stopLoss, 9);

const legacyPerps = parseFuturesAutomationForm(
  perpsForm({
    r0_tpsl: "on",
    r0_tpOn: "on",
    r0_takeProfit: "5",
    r0_tpKind: "percent",
    r0_slOn: "on",
    r0_stopLoss: "9",
    r0_slKind: "percent",
  }),
);
assert.equal(legacyPerps.ok, true);
if (!legacyPerps.ok) {
  throw new Error("expected a legacy both perps rule");
}
assert.equal(legacyPerps.rules[0]?.shortEntry?.classic ?? null, null);
assert.equal(
  perpsAutomationLegs(legacyPerps.rules[0]!).find((leg) => leg.side === "short")?.rule
    .tpsl?.stopLoss,
  9,
);

console.log("short classic checks passed");
