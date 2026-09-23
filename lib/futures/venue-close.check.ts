import assert from "node:assert/strict";
import { venueAlreadyFlatError } from "@/lib/exchanges/execute";
import { attributeClosingFill, pickClosingFill } from "./venue-close";

const picked = pickClosingFill({
  side: "long",
  openedAtMs: 1_000,
  qty: 0.02,
  executions: [
    {
      fillPrice: 100,
      closedQty: 0.01,
      execTimeMs: 2_000,
      side: "Sell",
      stopOrderType: "TakeProfit",
      orderLinkId: "",
    },
    {
      fillPrice: 102,
      closedQty: 0.01,
      execTimeMs: 2_100,
      side: "Sell",
      stopOrderType: "TakeProfit",
      orderLinkId: "",
    },
    {
      fillPrice: 90,
      closedQty: 0.5,
      execTimeMs: 500,
      side: "Sell",
      stopOrderType: "",
      orderLinkId: "",
    },
  ],
});
assert.ok(picked);
assert.equal(picked?.fillPrice, 101);
assert.equal(picked?.stopOrderType, "takeprofit");

assert.equal(
  attributeClosingFill({
    fillPrice: 101,
    stopOrderType: "TakeProfit",
    orderLinkId: "",
    takeProfit: 100.5,
    stopLoss: 95,
    hasExitIf: true,
  }),
  "take_profit",
);

assert.equal(
  attributeClosingFill({
    fillPrice: 100.08,
    stopOrderType: "",
    orderLinkId: "",
    takeProfit: 100.5,
    stopLoss: 95,
    hasExitIf: true,
  }),
  "exit_if",
);

assert.equal(
  attributeClosingFill({
    fillPrice: 100.08,
    stopOrderType: "",
    orderLinkId: "",
    takeProfit: 100.5,
    stopLoss: 95,
    hasExitIf: false,
  }),
  "venue",
);

assert.equal(
  attributeClosingFill({
    fillPrice: 94.95,
    stopOrderType: "",
    orderLinkId: "",
    takeProfit: 110,
    stopLoss: 95,
    hasExitIf: true,
  }),
  "stop_loss",
);

assert.equal(
  venueAlreadyFlatError("reduce only order would increase position"),
  true,
);
assert.equal(
  venueAlreadyFlatError(
    "current position is zero, cannot fix reduce-only order qty (110017)",
  ),
  true,
);
assert.equal(venueAlreadyFlatError("insufficient balance"), false);

console.log("venue close checks passed");
