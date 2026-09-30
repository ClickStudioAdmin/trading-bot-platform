import assert from "node:assert/strict";
import { venueAlreadyFlatError } from "@/lib/exchanges/execute";
import {
  linkedOrderState,
  isBybitDuplicateOrderLink,
  isBybitOrderLinkQuiet,
  BYBIT_ORDER_LINK_RESTING,
} from "@/lib/exchanges/bybit/orders";
import {
  attributeClosingFill,
  closingPositionIdxMatches,
  executionClosedQty,
  executionStopLabel,
  futuresCloseMessage,
  pickClosingFill,
  resolveVenueShrinkKind,
} from "./venue-close";

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
assert.equal(
  venueAlreadyFlatError("can not set tp/sl/ts for zero position"),
  true,
);
assert.equal(venueAlreadyFlatError("insufficient balance"), false);

assert.equal(
  executionStopLabel("", "CreateByTakeProfit"),
  "TakeProfit",
);
assert.equal(
  executionClosedQty({
    closedSize: 0,
    execQty: 0.4,
    stopOrderType: "",
    createType: "CreateByStopLoss",
  }),
  0.4,
);
assert.equal(
  executionClosedQty({
    closedSize: 0,
    execQty: 0.4,
    stopOrderType: "",
    createType: "",
  }),
  0.4,
);
assert.equal(closingPositionIdxMatches("long", 2), false);
assert.equal(closingPositionIdxMatches("short", 2), true);
assert.equal(
  pickClosingFill({
    side: "long",
    openedAtMs: 1_000,
    qty: 1,
    executions: [
      {
        fillPrice: 10,
        closedQty: 1,
        execTimeMs: 2_000,
        side: "Sell",
        stopOrderType: "",
        orderLinkId: "",
        positionIdx: 2,
      },
    ],
  }),
  null,
);
assert.equal(
  futuresCloseMessage({
    kind: "take_profit",
    symbol: "KITEUSDT",
    side: "long",
    closed: true,
  }),
  "Take profit closed KITEUSDT long",
);
assert.equal(linkedOrderState("Cancelled", 0), "dead");
assert.equal(linkedOrderState("New", 0), "resting");
assert.equal(linkedOrderState("Cancelled", 0.2), "filled");
assert.equal(
  isBybitDuplicateOrderLink("Bybit rejected that order: OrderLinkedID is duplicate"),
  true,
);
assert.equal(isBybitOrderLinkQuiet(BYBIT_ORDER_LINK_RESTING), true);
assert.equal(
  resolveVenueShrinkKind({
    tickerKind: "venue",
    fillKind: "take_profit",
    botOwned: true,
  }),
  "take_profit",
);
assert.equal(
  resolveVenueShrinkKind({
    tickerKind: "stop_loss",
    fillKind: null,
    botOwned: true,
  }),
  "stop_loss",
);
assert.equal(
  resolveVenueShrinkKind({
    tickerKind: "venue",
    fillKind: "venue",
    botOwned: true,
  }),
  null,
);
assert.equal(
  resolveVenueShrinkKind({
    tickerKind: "venue",
    fillKind: null,
    botOwned: false,
  }),
  "venue",
);

console.log("venue close checks passed");
