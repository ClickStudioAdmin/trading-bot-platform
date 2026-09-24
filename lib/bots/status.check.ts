import assert from "node:assert/strict";
import {
  dcaSaveVerb,
  dcaStatusFromLegs,
  botCanTakeBulkAction,
  botDeleteAllowed,
  bulkActionBlockReason,
  bulkDeleteBlockReason,
  bulkModeFor,
  disableConfirmMessage,
  disableConfirmMessageFor,
  disableConfirmTitle,
  disableConfirmTitleFor,
  disableNeedsConfirm,
  parseBotBulkAction,
  parseBulkBotIds,
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
assert.equal(disableConfirmTitle(), "Disable this bot?");
assert.equal(
  disableConfirmMessage("dca"),
  "Disabled closes every position this bot owns and turns it off.",
);
assert.equal(
  disableConfirmMessage("cnc"),
  "Disabled closes every carry this bot owns and turns it off.",
);
assert.equal(disableConfirmTitleFor(2), "Disable these bots?");
assert.equal(
  disableConfirmMessageFor("perps", 2),
  "Disabled closes every position these bots own and turns them off.",
);
assert.equal(parseBotBulkAction("enable"), "enable");
assert.equal(parseBotBulkAction("delete"), "delete");
assert.equal(parseBotBulkAction("nope"), null);
assert.equal(
  bulkDeleteBlockReason([
    { name: "Alpha", canRemove: true },
    { name: "Beta", canRemove: false },
  ]),
  "Delete can’t include Beta. Disable this bot before deleting it.",
);
assert.equal(botDeleteAllowed("active"), false);
assert.equal(botDeleteAllowed("stop_adding"), false);
assert.equal(botDeleteAllowed("reduce_only"), false);
assert.equal(botDeleteAllowed("disabled"), true);
assert.equal(
  bulkDeleteBlockReason([{ name: "Alpha", canRemove: true }]),
  null,
);
assert.equal(bulkModeFor("dca", "stop_adding"), "stop_adding");
assert.equal(bulkModeFor("perps", "stop_adding"), "reduce_only");
assert.equal(bulkModeFor("cnc", "disable"), "disabled");
assert.equal(botCanTakeBulkAction("active", "stop_adding"), true);
assert.equal(botCanTakeBulkAction("disabled", "stop_adding"), false);
assert.equal(botCanTakeBulkAction("reduce_only", "stop_adding"), false);
assert.equal(botCanTakeBulkAction("stop_adding", "enable"), true);
assert.equal(botCanTakeBulkAction("active", "enable"), false);
assert.equal(botCanTakeBulkAction("disabled", "disable"), false);
assert.equal(botCanTakeBulkAction("reduce_only", "disable"), true);
assert.equal(
  bulkActionBlockReason("stop_adding", [
    { name: "Alpha", statusKey: "active" },
    { name: "Beta", statusKey: "disabled" },
  ]),
  "Stop Adding can’t include Beta. Only an Active bot can stop adding.",
);
assert.equal(
  bulkActionBlockReason("enable", [{ name: "Alpha", statusKey: "disabled" }]),
  null,
);
assert.equal(
  bulkActionBlockReason("enable", [{ name: "Alpha", statusKey: "active" }]),
  "Enable can’t include Alpha. Those bots are already Active.",
);
const bulkIds = new FormData();
bulkIds.append("id", "a");
bulkIds.append("id", "a");
bulkIds.append("id", " b ");
assert.deepEqual(parseBulkBotIds(bulkIds), ["a", "b"]);
