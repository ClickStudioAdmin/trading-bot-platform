import assert from "node:assert/strict";
import { futuresPlaceNotice } from "./flash-notice";

assert.equal(
  futuresPlaceNotice("live-opened"),
  "Futures opened on the connected exchange.",
);
assert.equal(futuresPlaceNotice("working"), "Paper limit is working.");
assert.equal(futuresPlaceNotice("closed"), "Order placed.");

console.log("flash notice checks passed");
