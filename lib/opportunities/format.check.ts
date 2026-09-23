import assert from "node:assert/strict";
import {
  formatPnlUsd,
  formatPnlUsdFull,
  formatSignedUsd,
} from "./format";

assert.equal(formatSignedUsd(37.4), "+$37");
assert.equal(formatSignedUsd(-28.6), "−$29");
assert.equal(formatSignedUsd(0), "$0");
assert.equal(formatSignedUsd(0.23), "+$0");

assert.equal(formatPnlUsd(0.23), "+$0.23");
assert.equal(formatPnlUsd(0.2), "+$0.2");
assert.equal(formatPnlUsd(0.236), "+$0.24");
assert.equal(formatPnlUsd(-0.5), "−$0.5");
assert.equal(formatPnlUsd(-0.236), "−$0.24");
assert.equal(formatPnlUsd(0.004), "<$0.00");
assert.equal(formatPnlUsd(-0.004), "<$0.00");
assert.equal(formatPnlUsd(0), "$0");
assert.equal(formatPnlUsd(37.4), "+$37");
assert.equal(formatPnlUsd(-1.2), "−$1");
assert.equal(formatPnlUsd(1234.4), "+$1,234");

assert.equal(formatPnlUsdFull(0.234567891), "+$0.23456789");
assert.equal(formatPnlUsdFull(37.184), "+$37.184");
assert.equal(formatPnlUsdFull(-0.004), "−$0.004");
assert.equal(formatPnlUsdFull(0), "$0");
assert.equal(formatPnlUsdFull(1234.5), "+$1,234.5");

console.log("format checks passed");
