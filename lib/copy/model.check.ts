import assert from "node:assert/strict";
import {
  copyActivityFloorMet,
  DEFAULT_COPY_MIN_ACTIVITY_DAYS,
  MS_PER_DAY,
  parseCopyMinActivityDays,
} from "./model";

assert.equal(DEFAULT_COPY_MIN_ACTIVITY_DAYS, 90);

assert.equal(parseCopyMinActivityDays("").ok, false);
assert.equal(parseCopyMinActivityDays("abc").ok, false);
assert.equal(parseCopyMinActivityDays("-1").ok, false);
assert.equal(parseCopyMinActivityDays("1.5").ok, false);
assert.equal(parseCopyMinActivityDays("90").ok, true);
const zero = parseCopyMinActivityDays("0");
assert.equal(zero.ok, true);
if (zero.ok) {
  assert.equal(zero.days, 0);
}
const ninety = parseCopyMinActivityDays("90");
assert.equal(ninety.ok, true);
if (ninety.ok) {
  assert.equal(ninety.days, 90);
}

const now = Date.UTC(2026, 7, 31);
const firstFill = now - 90 * MS_PER_DAY;
assert.equal(
  copyActivityFloorMet({ firstFillMs: firstFill, minDays: 90, nowMs: now }),
  true,
);
assert.equal(
  copyActivityFloorMet({
    firstFillMs: firstFill + MS_PER_DAY,
    minDays: 90,
    nowMs: now,
  }),
  false,
);
assert.equal(
  copyActivityFloorMet({ firstFillMs: now, minDays: 0, nowMs: now }),
  true,
);
assert.equal(
  copyActivityFloorMet({ firstFillMs: null, minDays: 0, nowMs: now }),
  false,
);
assert.equal(
  copyActivityFloorMet({ firstFillMs: firstFill, minDays: -1, nowMs: now }),
  false,
);

console.log("copy model checks passed");
