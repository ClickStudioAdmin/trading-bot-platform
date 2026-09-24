import assert from "node:assert/strict";
import { groupReplayEventsByPosition } from "./event-groups";
import type { ReplayEvent, SimulatedOrder } from "./model";

function order(
  atMs: number,
  side: "long" | "short",
  action: SimulatedOrder["action"],
  reason: SimulatedOrder["reason"],
): SimulatedOrder {
  return {
    atMs,
    action,
    side,
    qty: 1,
    price: 100,
    feeUsdt: 0,
    realizedUsdt: action === "flatten" ? 1 : null,
    reason,
  };
}

function event(
  atMs: number,
  orderIndex: number | null,
  side: "long" | "short",
  reason: ReplayEvent["reason"],
  kind: ReplayEvent["kind"] = "fill",
): ReplayEvent {
  return {
    atMs,
    kind,
    reason,
    orderIndex,
    side,
    text: reason,
  };
}

const orders = [
  order(1, "long", "buy", "entry"),
  order(2, "long", "buy", "clip"),
  order(3, "long", "flatten", "take_profit"),
  order(4, "short", "sell", "entry"),
  order(5, "short", "flatten", "stop"),
];
const events = [
  event(1, 0, "long", "entry"),
  event(2, 1, "long", "clip"),
  event(3, 2, "long", "take_profit"),
  event(9, null, "short", "entry", "skipped"),
  event(4, 3, "short", "entry"),
  event(5, 4, "short", "stop"),
];

const groups = groupReplayEventsByPosition(events, orders);
assert.equal(groups.length, 3);
assert.equal(groups[0]?.label, "Long");
assert.deepEqual(
  groups[0]?.events.map((row) => row.reason),
  ["entry", "clip", "take_profit"],
);
assert.equal(groups[1]?.label, "Skipped");
assert.equal(groups[1]?.events.length, 1);
assert.equal(groups[2]?.label, "Short");
assert.deepEqual(
  groups[2]?.events.map((row) => row.reason),
  ["entry", "stop"],
);

console.log("event-groups.check: ok");
