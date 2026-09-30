import assert from "node:assert/strict";
import {
  chooseReplayLaneSlot,
  coalesceReplayPositions,
  groupReplayEventsByPosition,
  placeLaneCaption,
  replayLaneStillOpen,
} from "./event-groups";
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
assert.equal(groups[0]?.label, "1 Long");
assert.deepEqual(
  groups[0]?.events.map((row) => row.reason),
  ["entry", "clip", "take_profit"],
);
assert.equal(groups[1]?.label, "Skipped");
assert.equal(groups[1]?.events.length, 1);
assert.equal(groups[2]?.label, "2 Short");
assert.deepEqual(
  groups[2]?.events.map((row) => row.reason),
  ["entry", "stop"],
);

assert.equal(replayLaneStillOpen(groups[0]?.events ?? []), false);
assert.equal(replayLaneStillOpen((groups[0]?.events ?? []).slice(0, 2)), true);
assert.equal(replayLaneStillOpen(groups[2]?.events ?? []), false);

const interleavedOrders = [
  order(10, "long", "buy", "entry"),
  order(11, "short", "sell", "entry"),
  order(12, "long", "buy", "clip"),
  order(13, "short", "flatten", "take_profit"),
  order(14, "long", "flatten", "take_profit"),
];
const interleavedEvents = [
  event(10, 0, "long", "entry"),
  event(11, 1, "short", "entry"),
  event(12, 2, "long", "clip"),
  event(13, 3, "short", "take_profit"),
  event(14, 4, "long", "take_profit"),
];
const split = groupReplayEventsByPosition(interleavedEvents, interleavedOrders);
assert.ok(split.length > 2);
const merged = coalesceReplayPositions(split);
assert.equal(merged.length, 2);
assert.equal(merged[0]?.label, "1 Long");
assert.deepEqual(
  merged[0]?.events.map((row) => row.reason),
  ["entry", "clip", "take_profit"],
);
assert.equal(replayLaneStillOpen(merged[0]?.events ?? []), false);
assert.equal(merged[1]?.label, "2 Short");
assert.equal(replayLaneStillOpen(merged[1]?.events ?? []), false);
const stillOpen = coalesceReplayPositions(
  groupReplayEventsByPosition(interleavedEvents.slice(0, 4), interleavedOrders),
);
assert.equal(replayLaneStillOpen(stillOpen[0]?.events ?? []), true);

const slots: { x: number; width: number }[][] = [[], [], [], []];
assert.equal(chooseReplayLaneSlot(100, 70, true, slots), 0);
assert.equal(chooseReplayLaneSlot(130, 70, true, slots), 1);
assert.equal(chooseReplayLaneSlot(150, 70, true, slots), 2);

const captions: { x: number; width: number }[] = [];
const firstCaption = placeLaneCaption(40, 78, 0, 80, captions);
assert.equal(firstCaption.clear, true);
captions.push({ x: firstCaption.x, width: 78 });
const secondCaption = placeLaneCaption(100, 78, 90, 140, captions);
assert.equal(secondCaption.clear, true);
assert.ok(secondCaption.x >= 90);

console.log("event-groups.check: ok");
