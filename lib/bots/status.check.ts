import assert from "node:assert/strict";
import {
  dcaSaveVerb,
  dcaStatusFromLegs,
  disableNeedsConfirm,
  flattenOwnedRuleIds,
  parseDcaBotStatus,
} from "./status";

assert.equal(dcaStatusFromLegs({ armed: true, stopAdding: false }), "active");
assert.equal(
  dcaStatusFromLegs({ armed: false, stopAdding: true }),
  "stop_adding",
);
assert.equal(dcaStatusFromLegs({ armed: false, stopAdding: false }), "disabled");

assert.equal(
  dcaSaveVerb({
    selected: "active",
    running: false,
    armed: false,
    hasOpenPosition: false,
  }),
  "arm",
);
assert.equal(
  dcaSaveVerb({
    selected: "active",
    running: true,
    armed: true,
    hasOpenPosition: true,
  }),
  "save",
);
assert.equal(
  dcaSaveVerb({
    selected: "stop_adding",
    running: true,
    armed: true,
    hasOpenPosition: true,
  }),
  "disarm",
);
assert.equal(
  dcaSaveVerb({
    selected: "stop_adding",
    running: true,
    armed: true,
    hasOpenPosition: false,
  }),
  "disarm",
);
assert.equal(
  dcaSaveVerb({
    selected: "stop_adding",
    running: false,
    armed: false,
    hasOpenPosition: false,
  }),
  "save",
);
assert.equal(
  dcaSaveVerb({
    selected: "disabled",
    running: true,
    armed: true,
    hasOpenPosition: true,
  }),
  "close-playbook",
);
assert.equal(
  dcaSaveVerb({
    selected: "disabled",
    running: false,
    armed: false,
    hasOpenPosition: false,
  }),
  "save",
);
assert.equal(
  dcaSaveVerb({
    selected: "disabled",
    running: true,
    armed: true,
    hasOpenPosition: false,
  }),
  "disarm",
);

assert.equal(parseDcaBotStatus("stop_adding"), "stop_adding");
assert.equal(parseDcaBotStatus("disabled"), "disabled");
assert.equal(parseDcaBotStatus("active"), "active");
assert.equal(parseDcaBotStatus(""), "active");

assert.deepEqual(
  flattenOwnedRuleIds([
    { id: "a", mode: "disabled" },
    { id: null, mode: "disabled" },
    { id: "b", mode: "active" },
    { id: "", mode: "disabled" },
    { id: 4, mode: "disabled" },
  ]).map((row) => row.id),
  ["a", 4],
);

assert.equal(disableNeedsConfirm(true), true);
assert.equal(disableNeedsConfirm(false), false);
