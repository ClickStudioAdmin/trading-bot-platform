import assert from "node:assert/strict";
import {
  formatAuDateUtc,
  formatLocalTime,
  formatUtcDateTime,
  parseDisplayTime,
} from "./display";

const noonUtc = Date.parse("2026-08-24T23:50:26.000Z");
assert.equal(parseDisplayTime(noonUtc), noonUtc);
assert.equal(parseDisplayTime("2026-08-24T23:50:26.000Z"), noonUtc);
assert.equal(parseDisplayTime(null), null);
assert.equal(parseDisplayTime(""), null);
assert.equal(formatUtcDateTime(noonUtc), "2026-08-24 23:50:26 UTC");
assert.equal(formatAuDateUtc(Date.UTC(2021, 7, 31)), "31/08/2021");
assert.equal(formatAuDateUtc(Date.UTC(2026, 7, 30)), "30/08/2026");
assert.match(formatLocalTime(noonUtc, "date"), /^\d{4}-\d{2}-\d{2}$/);
assert.match(
  formatLocalTime(noonUtc, "datetime"),
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
);
assert.match(
  formatLocalTime(noonUtc, "datetime-short"),
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
);

console.log("time display checks passed");
