import assert from "node:assert/strict";
import {
  CLICK_GATE_MARGIN,
  clickGatePanelHeight,
  clickGateScrolls,
  placeClickGate,
  type ClickGatePlacement,
} from "../components/click-gate-notice";

function inside(
  placed: ClickGatePlacement,
  viewport: { width: number; height: number },
) {
  const margin = CLICK_GATE_MARGIN;
  assert.ok(placed.top >= margin - 0.01);
  assert.ok(placed.left >= margin - 0.01);
  assert.ok(placed.top + placed.maxHeight <= viewport.height - margin + 0.01);
  assert.ok(placed.left + placed.width <= viewport.width - margin + 0.01);
  assert.ok(placed.width >= 0);
  assert.ok(placed.maxHeight >= 0);
}

const desktop = { width: 1280, height: 800 };
const panel = { width: 448, height: 72 };

const below = placeClickGate(
  { top: 80, left: 40, right: 160, bottom: 112 },
  panel,
  desktop,
);
assert.equal(below.side, "below");
assert.equal(below.top, 120);
assert.equal(below.left, 40);
assert.equal(below.width, 448);
assert.equal(below.maxHeight, 72);
inside(below, desktop);

const above = placeClickGate(
  { top: 740, left: 40, right: 160, bottom: 772 },
  panel,
  desktop,
);
assert.equal(above.side, "above");
assert.equal(above.top, 660);
assert.equal(above.left, 40);
assert.equal(above.maxHeight, 72);
inside(above, desktop);

const shifted = placeClickGate(
  { top: 80, left: 1100, right: 1240, bottom: 112 },
  panel,
  desktop,
);
assert.equal(shifted.side, "below");
assert.equal(shifted.left, 1280 - CLICK_GATE_MARGIN - 448);
assert.equal(shifted.left + shifted.width, 1280 - CLICK_GATE_MARGIN);
inside(shifted, desktop);

const beside = placeClickGate(
  { top: 360, left: 40, right: 120, bottom: 400 },
  { width: 448, height: 500 },
  desktop,
);
assert.equal(beside.side, "right");
assert.equal(beside.width, 448);
assert.equal(beside.maxHeight, 500);
inside(beside, desktop);

const narrow = { width: 360, height: 640 };
const phone = placeClickGate(
  { top: 80, left: 16, right: 140, bottom: 112 },
  panel,
  narrow,
);
assert.equal(phone.side, "below");
assert.ok(phone.width <= narrow.width - CLICK_GATE_MARGIN * 2);
inside(phone, narrow);

const tight = { width: 360, height: 400 };
const partial = placeClickGate(
  { top: 180, left: 20, right: 80, bottom: 220 },
  { width: 448, height: 700 },
  tight,
);
inside(partial, tight);
assert.ok(partial.maxHeight <= tight.height - CLICK_GATE_MARGIN * 2);
assert.ok(partial.maxHeight > 0);

assert.equal(clickGatePanelHeight(46.2), 47);
assert.equal(clickGateScrolls(48, 48), false);
assert.equal(clickGateScrolls(200, 80), true);

console.log("place click gate checks passed");
