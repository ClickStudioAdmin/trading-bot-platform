import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "./playbook";
import {
  atrBandMet,
  dcaFilterComplete,
  dcaFilterLabel,
  dcaFilterMet,
  dcaFilterSpecForKind,
  dcaFilterSummaryLine,
  dcaFilterWhenOptions,
  filterColumns,
  filterFromRow,
  parseDcaFilterForm,
  parseDcaFilterKind,
  parseDcaFilterSpec,
  sitDcaFilterCompare,
  type DcaFilterKind,
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
assert.equal(sitDcaFilterCompare("cross_gte"), "gte");
assert.equal(sitDcaFilterCompare("cross_lte"), "lte");
assert.equal(
  parseDcaFilterSpec({
    kind: "supertrend",
    timeframe: "240",
    compare: "cross_gte",
    level: null,
    period: 10,
    multiplier: 3,
  })?.compare,
  "gte",
);
for (const kind of [
  "ema",
  "sma",
  "rsi",
  "bb",
  "atr_band",
  "supertrend",
] as const satisfies readonly DcaFilterKind[]) {
  const values = dcaFilterWhenOptions(kind).map((row) => row.value);
  assert.equal(values.includes("cross_gte"), false);
  assert.equal(values.includes("cross_lte"), false);
  assert.ok(values.includes("gte"));
  assert.ok(values.includes("lte"));
}
assert.ok(dcaFilterWhenOptions("rsi").some((row) => row.value === "between"));
assert.ok(dcaFilterWhenOptions("bb").some((row) => row.value === "inside"));
assert.ok(dcaFilterWhenOptions("atr_band").some((row) => row.value === "inside"));
assert.equal(
  dcaFilterWhenOptions("ema").some((row) => row.value === "inside"),
  false,
);
assert.equal(
  dcaFilterWhenOptions("supertrend").some((row) => row.value === "between"),
  false,
);
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
assert.equal(
  atrBandMet({
    bars: flatBars,
    period: 10,
    multiplier: 2,
    compare: "inside",
  }),
  true,
);
assert.equal(
  atrBandMet({
    bars: [...flatBars.slice(0, -1), { high: 200, low: 199, close: 200 }],
    period: 10,
    multiplier: 2,
    compare: "inside",
  }),
  false,
);

const midRsi = [10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10];
const rsiBetween: DcaFilterSpec = {
  kind: "rsi",
  timeframe: "15",
  compare: "between",
  level: 30,
  levelTo: 70,
  period: 14,
  multiplier: null,
};
assert.equal(
  dcaFilterMet({
    spec: rsiBetween,
    side: "long",
    closes: midRsi,
    bars: null,
  }),
  true,
);
assert.equal(
  dcaFilterMet({
    spec: rsiBetween,
    side: "long",
    closes: rising,
    bars: null,
  }),
  false,
);

const flatCloses = Array.from({ length: 24 }, () => 100);
const bbInside: DcaFilterSpec = {
  kind: "bb",
  timeframe: "15",
  compare: "inside",
  level: null,
  period: 20,
  multiplier: null,
};
assert.equal(
  dcaFilterMet({
    spec: bbInside,
    side: "long",
    closes: flatCloses,
    bars: null,
  }),
  true,
);
assert.equal(
  dcaFilterMet({
    spec: bbInside,
    side: "long",
    closes: [...flatCloses.slice(0, -1), 200],
    bars: null,
  }),
  false,
);

const rsiBetweenCols = filterColumns("confirm", rsiBetween);
assert.equal(rsiBetweenCols.confirm_compare, "between");
assert.equal(rsiBetweenCols.confirm_level, 30);
assert.equal(rsiBetweenCols.confirm_multiplier, 70);
const rsiBetweenRow = filterFromRow(rsiBetweenCols, "confirm");
assert.equal(rsiBetweenRow?.compare, "between");
assert.equal(rsiBetweenRow?.level, 30);
assert.equal(rsiBetweenRow?.levelTo, 70);

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

const rsiBetweenMissing = parseDcaFilterForm(
  (() => {
    const form = new FormData();
    form.set("confirmKind", "rsi");
    form.set("confirmTimeframe", "15");
    form.set("confirmCompare", "between");
    form.set("confirmLevel", "30");
    form.set("confirmPeriod", "14");
    return form;
  })(),
  "confirm",
  false,
  "Confirm",
);
assert.equal(rsiBetweenMissing.ok, false);

const rsiBetweenFlipped = parseDcaFilterForm(
  (() => {
    const form = new FormData();
    form.set("confirmKind", "rsi");
    form.set("confirmTimeframe", "15");
    form.set("confirmCompare", "between");
    form.set("confirmLevel", "70");
    form.set("confirmLevelTo", "30");
    form.set("confirmPeriod", "14");
    return form;
  })(),
  "confirm",
  false,
  "Confirm",
);
assert.equal(rsiBetweenFlipped.ok, false);

const rsiBetweenOk = parseDcaFilterForm(
  (() => {
    const form = new FormData();
    form.set("confirmKind", "rsi");
    form.set("confirmTimeframe", "15");
    form.set("confirmCompare", "between");
    form.set("confirmLevel", "30");
    form.set("confirmLevelTo", "70");
    form.set("confirmPeriod", "14");
    return form;
  })(),
  "confirm",
  false,
  "Confirm",
);
assert.equal(rsiBetweenOk.ok, true);
if (rsiBetweenOk.ok) {
  assert.equal(rsiBetweenOk.spec?.compare, "between");
  assert.equal(rsiBetweenOk.spec?.level, 30);
  assert.equal(rsiBetweenOk.spec?.levelTo, 70);
  assert.equal(dcaFilterComplete(rsiBetweenOk.spec), true);
}
assert.equal(
  dcaFilterComplete({
    kind: "rsi",
    timeframe: "15",
    compare: "lte",
    level: null,
    period: 14,
    multiplier: null,
  }),
  false,
);

console.log("dca filter checks passed");
