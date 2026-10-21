import assert from "node:assert/strict";
import {
  advanceTrailingOnBar,
  armTrailingAt,
  paperTrailingAdvance,
  parseFuturesTrailingForm,
  parseFuturesTrailingPatch,
  trailingColumns,
  trailingFromRow,
  trailingHasStop,
  validateTrailingVsReference,
} from "./trailing";
import {
  applyTrailingToVenueStop,
  combinedVenueTradingStop,
  emptyFuturesTpsl,
  venueTradingStopFields,
} from "./tpsl";

const on = new FormData();
on.set("trailing", "on");
on.set("trailingStop", "250");
const parsed = parseFuturesTrailingForm(on, undefined);
assert.equal(parsed.ok, true);
if (parsed.ok && parsed.trailing) {
  assert.equal(parsed.trailing.distance, 250);
  assert.equal(parsed.trailing.activePrice, null);
}
const percentActivation = new FormData();
percentActivation.set("trailing", "on");
percentActivation.set("trailingStop", "250");
percentActivation.set("trailingActiveKind", "percent");
percentActivation.set("trailingTriggerPct", "2.5");
const percentParsed = parseFuturesTrailingForm(percentActivation, undefined, {
  requireActivation: true,
});
assert.equal(percentParsed.ok, true);
if (percentParsed.ok && percentParsed.trailing) {
  assert.equal(percentParsed.trailing.distance, 250);
  assert.equal(percentParsed.trailing.activePrice, null);
}
const percentBlank = new FormData();
percentBlank.set("trailing", "on");
percentBlank.set("trailingStop", "250");
percentBlank.set("trailingActiveKind", "percent");
const percentMissing = parseFuturesTrailingForm(percentBlank, undefined, {
  requireActivation: true,
});
assert.equal(percentMissing.ok, false);
if (!percentMissing.ok) {
  assert.equal(percentMissing.error, "Enter an activation percent.");
}
const requiredActivation = parseFuturesTrailingForm(
  (() => {
    const form = new FormData();
    form.set("trailing", "on");
    form.set("trailingStop", "250");
    return form;
  })(),
  undefined,
  { requireActivation: true },
);
assert.equal(requiredActivation.ok, false);
if (!requiredActivation.ok) {
  assert.equal(requiredActivation.error, "Enter an activation price.");
}

const withActive = new FormData();
withActive.set("trailing", "on");
withActive.set("trailingStop", "250");
withActive.set("trailingActivation", "on");
withActive.set("trailingActive", "80,000");
const activeParsed = parseFuturesTrailingForm(withActive, undefined);
assert.equal(activeParsed.ok, true);
if (activeParsed.ok && activeParsed.trailing) {
  assert.equal(activeParsed.trailing.activePrice, 80000);
}

const empty = new FormData();
const emptyParsed = parseFuturesTrailingForm(empty, undefined);
assert.equal(emptyParsed.ok, true);
if (emptyParsed.ok) {
  assert.equal(emptyParsed.trailing, null);
}

const emptyOn = new FormData();
emptyOn.set("trailing", "on");
assert.equal(parseFuturesTrailingForm(emptyOn, undefined).ok, false);

const clearPatch = new FormData();
const cleared = parseFuturesTrailingPatch(clearPatch, undefined);
assert.equal(cleared.ok, true);
if (cleared.ok) {
  assert.equal(cleared.trailing, null);
}

assert.equal(
  validateTrailingVsReference({
    side: "long",
    trailing: { distance: 250, activePrice: 81000, peak: null },
    reference: 80000,
  }).ok,
  true,
);
assert.equal(
  validateTrailingVsReference({
    side: "long",
    trailing: { distance: 250, activePrice: 79000, peak: null },
    reference: 80000,
  }).ok,
  false,
);
assert.equal(
  validateTrailingVsReference({
    side: "short",
    trailing: { distance: 250, activePrice: 79000, peak: null },
    reference: 80000,
  }).ok,
  true,
);

const armed = armTrailingAt(
  { distance: 250, activePrice: null, peak: null },
  80000,
);
assert.equal(armed?.peak, 80000);

const waits = armTrailingAt(
  { distance: 250, activePrice: 81000, peak: null },
  80000,
);
assert.equal(waits?.peak, null);

const waiting = paperTrailingAdvance({
  side: "long",
  trailing: { distance: 250, activePrice: 81000, peak: null },
  last: 80000,
});
assert.equal(waiting.peak, null);
assert.equal(waiting.hit, false);

const justArmed = paperTrailingAdvance({
  side: "long",
  trailing: { distance: 250, activePrice: null, peak: null },
  last: 80000,
});
assert.equal(justArmed.peak, 80000);
assert.equal(justArmed.hit, false);

const newPeak = paperTrailingAdvance({
  side: "long",
  trailing: { distance: 250, activePrice: null, peak: 80000 },
  last: 80500,
});
assert.equal(newPeak.peak, 80500);
assert.equal(newPeak.hit, false);

const longHit = paperTrailingAdvance({
  side: "long",
  trailing: { distance: 250, activePrice: null, peak: 80500 },
  last: 80250,
});
assert.equal(longHit.hit, true);
assert.equal(longHit.fillPrice, 80250);

const shortHit = paperTrailingAdvance({
  side: "short",
  trailing: { distance: 250, activePrice: null, peak: 80000 },
  last: 80250,
});
assert.equal(shortHit.hit, true);
assert.equal(shortHit.fillPrice, 80250);

const fromRow = trailingFromRow({
  trailingStop: 250,
  trailingActive: 81000,
  trailingPeak: 81200,
});
assert.equal(fromRow?.distance, 250);
assert.equal(fromRow?.peak, 81200);
assert.equal(trailingHasStop(fromRow), true);
assert.deepEqual(trailingColumns(fromRow), {
  trailing_stop: 250,
  trailing_active: 81000,
  trailing_peak: 81200,
});

const venue = applyTrailingToVenueStop(
  venueTradingStopFields(emptyFuturesTpsl()),
  { distance: 250, activePrice: 81000 },
);
assert.equal(venue.trailingStop, "250");
assert.equal(venue.activePrice, "81000");
assert.equal(venue.takeProfit, "0");

const clearedVenue = combinedVenueTradingStop(null, null);
assert.equal(clearedVenue.trailingStop, "0");

const longWick = advanceTrailingOnBar({
  side: "long",
  trailing: { distance: 5, activePrice: 110, peak: null },
  favorable: 118,
  adverse: 103,
});
assert.equal(longWick.peak, 118);
assert.equal(longWick.stop, 113);
assert.equal(longWick.hit, true);

const longHold = advanceTrailingOnBar({
  side: "long",
  trailing: { distance: 5, activePrice: 110, peak: null },
  favorable: 118,
  adverse: 114,
});
assert.equal(longHold.peak, 118);
assert.equal(longHold.stop, 113);
assert.equal(longHold.hit, false);

const shortWick = advanceTrailingOnBar({
  side: "short",
  trailing: { distance: 5, activePrice: 90, peak: null },
  favorable: 82,
  adverse: 97,
});
assert.equal(shortWick.peak, 82);
assert.equal(shortWick.stop, 87);
assert.equal(shortWick.hit, true);

console.log("futures trailing checks passed");
