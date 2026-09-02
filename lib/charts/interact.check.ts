import assert from "node:assert/strict";
import {
  isOverRightPriceScale,
  wheelZoomFactor,
  zoomPriceRange,
} from "./interact";

const zoomed = zoomPriceRange({ from: 100, to: 200 }, 0.5, 0.5);
assert.ok(zoomed);
assert.equal(zoomed.from, 125);
assert.equal(zoomed.to, 175);

const fromTop = zoomPriceRange({ from: 0, to: 100 }, 0.5, 1);
assert.ok(fromTop);
assert.equal(fromTop.from, 50);
assert.equal(fromTop.to, 100);

assert.equal(zoomPriceRange({ from: 10, to: 10 }, 0.5, 0.5), null);
assert.ok(wheelZoomFactor(40) > 1);
assert.ok(wheelZoomFactor(-40) < 1);

const host = {
  getBoundingClientRect: () => ({
    left: 0,
    right: 400,
    top: 0,
    bottom: 200,
    width: 400,
    height: 200,
  }),
} as HTMLElement;
assert.equal(isOverRightPriceScale(host, 60, 370), true);
assert.equal(isOverRightPriceScale(host, 60, 300), false);

console.log("chart interact checks passed");
