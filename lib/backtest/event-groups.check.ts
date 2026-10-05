import assert from "node:assert/strict";
import {
  coalesceReplayPositions,
  fitLaneCaption,
  groupReplayEventsByPosition,
  placeLaneCaption,
  replayEventLabelWidth,
  replayLaneLabelsOverlap,
  replayLaneStillOpen,
  replayMarkerInPositionFocus,
  replayPositionVisibleRange,
  separateLaneLabels,
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

assert.equal(fitLaneCaption("Position #3", 40), "#3");
assert.equal(fitLaneCaption("Position #4", 200), "Position #4");
assert.equal(fitLaneCaption("Skipped", 10), "Skipped");

const captions: { x: number; width: number }[] = [];
const firstCaption = placeLaneCaption(40, 78, 0, 80, captions);
assert.equal(firstCaption.clear, true);
captions.push({ x: firstCaption.x, width: 78 });
const secondCaption = placeLaneCaption(100, 78, 90, 140, captions);
assert.equal(secondCaption.clear, true);
assert.ok(secondCaption.x >= 90);

const positionFocus = new Set([0, 1, 2]);
assert.equal(replayMarkerInPositionFocus(1, positionFocus), true);
assert.equal(replayMarkerInPositionFocus(3, positionFocus), false);
assert.equal(replayMarkerInPositionFocus(null, positionFocus), false);
assert.equal(replayMarkerInPositionFocus(4, null), true);

const onScreen = { from: 0, to: 100 };
assert.equal(replayPositionVisibleRange(10, 40, onScreen), null);
const panned = replayPositionVisibleRange(90, 110, onScreen);
assert.deepEqual(panned, { from: 10, to: 110 });
assert.equal(panned && panned.to - panned.from, 100);
const zoomed = replayPositionVisibleRange(0, 200, onScreen);
assert.ok(zoomed);
assert.ok(zoomed.from < 0);
assert.ok(zoomed.to > 200);
assert.ok(zoomed.to - zoomed.from > 100);

function labelsStayApart(
  boxes: { x: number; width: number }[],
  placed: number[],
  gap: number,
): void {
  const row = boxes
    .map((box, index) => ({ x: placed[index] ?? box.x, width: box.width }))
    .sort((left, right) => left.x - right.x);
  for (let index = 1; index < row.length; index += 1) {
    const previous = row[index - 1];
    const current = row[index];
    if (!previous || !current) {
      continue;
    }
    assert.equal(replayLaneLabelsOverlap(previous, current, gap), false);
  }
}

const apart = [
  { x: 40, width: replayEventLabelWidth("Entry") },
  { x: 220, width: replayEventLabelWidth("SL") },
];
const apartPlaced = separateLaneLabels(apart, 8);
assert.deepEqual(apartPlaced, [40, 220]);

const stacked = [
  { x: 180, width: replayEventLabelWidth("Entry") },
  { x: 184, width: replayEventLabelWidth("SL") },
];
const stackedPlaced = separateLaneLabels(stacked, 8);
labelsStayApart(stacked, stackedPlaced, 8);
assert.ok(Math.abs((stackedPlaced[0]! + stackedPlaced[1]!) / 2 - 182) < 1);

const crowded = ["Entry", "Add", "TP"].map((label, index) => ({
  x: 300 + index,
  width: replayEventLabelWidth(label),
}));
const crowdedPlaced = separateLaneLabels(crowded, 8);
labelsStayApart(crowded, crowdedPlaced, 8);

const mixed = [
  { x: 40, width: replayEventLabelWidth("Entry") },
  { x: 42, width: replayEventLabelWidth("SL") },
  { x: 400, width: replayEventLabelWidth("TP") },
];
const mixedPlaced = separateLaneLabels(mixed, 8);
labelsStayApart(mixed, mixedPlaced, 8);
assert.equal(mixedPlaced[2], 400);

const clipped = separateLaneLabels(
  [
    { x: 4, width: replayEventLabelWidth("Entry") },
    { x: 8, width: replayEventLabelWidth("SL") },
  ],
  8,
  { min: 0, max: 240 },
);
labelsStayApart(
  [
    { x: 4, width: replayEventLabelWidth("Entry") },
    { x: 8, width: replayEventLabelWidth("SL") },
  ],
  clipped,
  8,
);
assert.ok(clipped[0]! - replayEventLabelWidth("Entry") / 2 >= -0.01);

console.log("event-groups.check: ok");
