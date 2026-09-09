import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "./playbook";
import {
  atrBandMet,
  dcaFilterLabel,
  dcaFilterMet,
  dcaFilterSpecForKind,
  dcaFilterSummaryLine,
  parseDcaFilterForm,
  parseDcaFilterKind,
  type DcaFilterSpec,
} from "./filters";

const emaLong = dcaFilterSpecForKind("ema", "long");
assert.equal(emaLong.kind, "ema");
assert.equal(emaLong.timeframe, "240");
assert.equal(emaLong.compare, "gte");
assert.equal(dcaFilterLabel(emaLong), "Price vs EMA · 4h");
assert.equal(dcaFilterLabel(null), "Off");
assert.equal(
  dcaFilterSummaryLine("Confirm", emaLong),
  "Confirm: Price vs EMA · 4h",
);
assert.equal(dcaFilterSummaryLine("Confirm", null), null);
assert.equal(parseDcaFilterKind(""), null);
assert.equal(parseDcaFilterKind("macd"), null);
assert.equal(parseDcaFilterKind("ema"), "ema");

assert.equal(dcaFilterMet({ spec: null, side: "long", closes: [], bars: [] }), true);

const rsiConfirm: DcaFilterSpec = {
  kind: "rsi",
  timeframe: "15",
  compare: "lte",
  level: 30,
  period: 14,
  multiplier: null,
};
const rising = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
assert.equal(
  dcaFilterMet({
    spec: rsiConfirm,
    side: "long",
    closes: rising,
    bars: null,
  }),
  false,
);
assert.equal(
  dcaFilterMet({
    spec: { ...rsiConfirm, compare: "gte", level: 70 },
    side: "long",
    closes: rising,
    bars: null,
  }),
  true,
);
assert.equal(
  dcaFilterMet({
    spec: rsiConfirm,
    side: "long",
    closes: [],
    bars: [],
  }),
  false,
);

const flatBars = Array.from({ length: 20 }, () => ({
  high: 101,
  low: 99,
  close: 100,
}));
assert.equal(
  atrBandMet({
    bars: flatBars,
    period: 10,
    multiplier: 2,
    compare: "gte",
  }),
  false,
);
assert.equal(
  atrBandMet({
    bars: [...flatBars.slice(0, -1), { high: 200, low: 199, close: 200 }],
    period: 10,
    multiplier: 2,
    compare: "gte",
  }),
  true,
);
assert.equal(
  atrBandMet({
    bars: [...flatBars.slice(0, -1), { high: 2, low: 1, close: 1 }],
    period: 10,
    multiplier: 2,
    compare: "lte",
  }),
  true,
);
assert.equal(
  atrBandMet({
    bars: flatBars.slice(0, 5),
    period: 10,
    multiplier: 2,
    compare: "gte",
  }),
  null,
);

const offForm = new FormData();
offForm.set("symbol", "BTCUSDT");
offForm.set("direction", "long");
offForm.set("clipSize", "1");
offForm.set("sizeUnit", "qty");
offForm.set("startKind", "immediate");
const offParsed = parseDcaPlaybookForm(offForm);
assert.equal(offParsed.ok, true);
if (offParsed.ok) {
  assert.equal(offParsed.config.confirm, null);
  assert.equal(offParsed.config.exitIf, null);
}

const onForm = new FormData();
onForm.set("symbol", "BTCUSDT");
onForm.set("direction", "long");
onForm.set("clipSize", "1");
onForm.set("sizeUnit", "qty");
onForm.set("startKind", "immediate");
onForm.set("confirmKind", "ema");
onForm.set("confirmTimeframe", "240");
onForm.set("confirmCompare", "gte");
onForm.set("confirmPeriod", "21");
onForm.set("exitIfKind", "rsi");
onForm.set("exitIfTimeframe", "15");
onForm.set("exitIfCompare", "gte");
onForm.set("exitIfLevel", "70");
onForm.set("exitIfPeriod", "14");
const onParsed = parseDcaPlaybookForm(onForm);
assert.equal(onParsed.ok, true);
if (onParsed.ok) {
  assert.equal(onParsed.config.confirm?.kind, "ema");
  assert.equal(onParsed.config.confirm?.timeframe, "240");
  assert.equal(onParsed.config.exitIf?.kind, "rsi");
  assert.equal(onParsed.config.exitIf?.level, 70);
}

const bothForm = new FormData();
bothForm.set("symbol", "BTCUSDT");
bothForm.set("direction", "both");
bothForm.set("clipSize", "1");
bothForm.set("sizeUnit", "qty");
bothForm.set("startKind", "immediate");
bothForm.set("confirmKind", "ema");
bothForm.set("confirmTimeframe", "240");
bothForm.set("confirmCompare", "gte");
bothForm.set("confirmPeriod", "21");
bothForm.set("shortConfirmKind", "ema");
bothForm.set("shortConfirmTimeframe", "240");
bothForm.set("shortConfirmCompare", "lte");
bothForm.set("shortConfirmPeriod", "21");
const bothParsed = parseDcaPlaybookForm(bothForm);
assert.equal(bothParsed.ok, true);
if (bothParsed.ok) {
  assert.equal(bothParsed.config.confirm?.compare, "gte");
  assert.equal(bothParsed.config.shortConfirm?.compare, "lte");
}

const rsiMissing = parseDcaFilterForm(
  (() => {
    const form = new FormData();
    form.set("confirmKind", "rsi");
    form.set("confirmTimeframe", "15");
    form.set("confirmCompare", "lte");
    form.set("confirmPeriod", "14");
    return form;
  })(),
  "confirm",
  false,
  "Confirm",
);
assert.equal(rsiMissing.ok, false);

console.log("dca filter checks passed");
