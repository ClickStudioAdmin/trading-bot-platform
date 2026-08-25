import assert from "node:assert/strict";
import {
  formatMarginModeLabel,
  formatSnapshotMoney,
  marginRateTone,
  parseBybitAccountMoney,
  parseBybitAccountRate,
  parseBybitMarginMode,
  snapshotFromBybit,
} from "./account";

assert.equal(parseBybitMarginMode("REGULAR_MARGIN"), "cross");
assert.equal(parseBybitMarginMode("ISOLATED_MARGIN"), "isolated");
assert.equal(parseBybitMarginMode("PORTFOLIO_MARGIN"), "portfolio");
assert.equal(parseBybitMarginMode("nope"), null);
assert.equal(formatMarginModeLabel("cross"), "Cross");

assert.equal(parseBybitAccountMoney("145811.7337"), 145811.7337);
assert.equal(parseBybitAccountMoney("0"), 0);
assert.equal(parseBybitAccountMoney(""), null);
assert.equal(parseBybitAccountRate("0.055"), 0.055);
assert.equal(parseBybitAccountRate("-1"), null);

assert.equal(formatSnapshotMoney(137790.0517), "$137,790.05");
assert.equal(formatSnapshotMoney(0), "$0.00");
assert.equal(formatSnapshotMoney(null), "—");

assert.equal(marginRateTone(0.055), "text-success");
assert.equal(marginRateTone(0.6), "text-warning");
assert.equal(marginRateTone(0.9), "text-danger");

const parsed = snapshotFromBybit({
  wallet: {
    list: [
      {
        accountIMRate: "0.055",
        accountMMRate: "0.002",
        totalMarginBalance: "145811.7337",
        totalAvailableBalance: "137790.0517",
      },
    ],
  },
  info: { marginMode: "REGULAR_MARGIN" },
});
assert.equal(parsed?.marginMode, "cross");
assert.equal(parsed?.initialMarginRate, 0.055);
assert.equal(parsed?.maintenanceMarginRate, 0.002);
assert.equal(parsed?.marginBalance, 145811.7337);
assert.equal(parsed?.availableBalance, 137790.0517);

const isolated = snapshotFromBybit({
  wallet: {
    list: [
      {
        accountIMRate: "0.1",
        accountMMRate: "0.02",
        totalMarginBalance: "10",
        totalAvailableBalance: "8",
      },
    ],
  },
  info: { marginMode: "ISOLATED_MARGIN" },
});
assert.equal(isolated?.marginMode, "isolated");
assert.equal(isolated?.initialMarginRate, null);
assert.equal(isolated?.maintenanceMarginRate, null);

assert.equal(snapshotFromBybit({ wallet: { list: [] } }), null);

console.log("bybit account snapshot checks passed");
