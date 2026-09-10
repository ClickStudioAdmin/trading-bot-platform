import assert from "node:assert/strict";
import {
  dcaSyncAttemptsMatch,
  dcaSyncFailureStamp,
  dcaSyncFailuresMatch,
  shouldSkipDcaSyncRetry,
  stampFromSyncFailedData,
} from "./sync-failure";

const base = dcaSyncFailureStamp({
  playbookId: "pb-1",
  playbookUpdatedAtMs: 1000,
  reason: "rest_grid",
  clipIndex: 12,
  qty: 409_600,
  limitPrice: 121_648.44,
  error: "Bybit rejected that order: price is invalid",
});

assert.equal(dcaSyncAttemptsMatch(base, base), true);
assert.equal(dcaSyncFailuresMatch(base, base), true);
assert.equal(
  shouldSkipDcaSyncRetry([base], {
    ...base,
    error: "",
  }),
  true,
);
assert.equal(
  shouldSkipDcaSyncRetry(
    [base],
    dcaSyncFailureStamp({
      ...base,
      playbookUpdatedAtMs: 2000,
      error: "",
    }),
  ),
  false,
);
assert.equal(
  shouldSkipDcaSyncRetry(
    [base],
    dcaSyncFailureStamp({
      ...base,
      qty: 100,
      error: "",
    }),
  ),
  false,
);
assert.equal(
  dcaSyncFailuresMatch(
    base,
    dcaSyncFailureStamp({
      ...base,
      error: "Different",
    }),
  ),
  false,
);

const fromData = stampFromSyncFailedData(
  "pb-1",
  {
    reason: "rest_grid",
    playbookUpdatedAtMs: 1000,
    clipIndex: 12,
    qty: 409_600,
    limitPrice: 121_648.44,
  },
  "Bybit rejected that order: price is invalid",
);
assert.equal(fromData !== null, true);
assert.equal(fromData ? dcaSyncFailuresMatch(base, fromData) : false, true);
assert.equal(stampFromSyncFailedData("pb-1", {}), null);

console.log("dca sync-failure checks passed");
