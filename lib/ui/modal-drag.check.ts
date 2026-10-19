import assert from "node:assert/strict";
import { nextModalDragOffset } from "./modal-drag";

const frame = {
  dialogWidth: 200,
  dialogHeight: 100,
  viewportWidth: 1000,
  viewportHeight: 800,
};

const still = nextModalDragOffset({
  originX: 0,
  originY: 0,
  startX: 40,
  startY: 40,
  clientX: 40,
  clientY: 40,
  ...frame,
});
assert.deepEqual(still, { x: 0, y: 0 });

const nudged = nextModalDragOffset({
  originX: 10,
  originY: -4,
  startX: 100,
  startY: 80,
  clientX: 140,
  clientY: 50,
  ...frame,
});
assert.deepEqual(nudged, { x: 50, y: -34 });

const offLeft = nextModalDragOffset({
  originX: 0,
  originY: 0,
  startX: 0,
  startY: 0,
  clientX: -10000,
  clientY: 0,
  ...frame,
});
assert.equal(offLeft.x, 12 - (1000 - 200) / 2);
assert.equal(offLeft.y, 0);

const offBottom = nextModalDragOffset({
  originX: 0,
  originY: 0,
  startX: 0,
  startY: 0,
  clientX: 0,
  clientY: 10000,
  ...frame,
});
assert.equal(offBottom.y, 800 - 100 - 12 - (800 - 100) / 2);

console.log("modal drag checks passed");
