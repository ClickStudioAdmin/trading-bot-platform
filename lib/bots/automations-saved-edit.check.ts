import assert from "node:assert/strict";
import { automationsSavedBotHref } from "./automations-path";
import {
  mergeSavedPlaybookCard,
  nextShownAutomationsEdit,
  withCreatedFormKey,
} from "./automations-saved-edit";

const list = "/strategies/futures/automations?desk=desk-1";

assert.equal(
  automationsSavedBotHref(list, "pb-1"),
  "/strategies/futures/automations?desk=desk-1&edit=pb-1",
);
assert.equal(automationsSavedBotHref(list, " pb-1 ").includes("saved"), false);
assert.equal(automationsSavedBotHref(list, "pb-1").includes("notice"), false);

const stayed = nextShownAutomationsEdit("new", "new", "pb-1");
assert.deepEqual(stayed, { seenEdit: "new", shownEdit: "pb-1" });

const opened = nextShownAutomationsEdit("pb-2", "new", "pb-1");
assert.deepEqual(opened, { seenEdit: "pb-2", shownEdit: "pb-2" });

const stamped = withCreatedFormKey(
  [
    { id: "old", key: "old" },
    { id: "pb-1", key: "pb-1" },
  ],
  "pb-1",
  "new-draft",
);
assert.equal(stamped[1]?.key, "new-draft");
assert.equal(stamped[0]?.key, "old");
assert.equal(
  withCreatedFormKey([{ id: "pb-1", key: "kept" }], null, "new-draft")[0]?.key,
  "kept",
);

const draftCards: { key: string; playbook: { id: string } | null }[] = [
  { key: "new-draft", playbook: null },
];
const created = mergeSavedPlaybookCard(draftCards, { id: "pb-1" }, "new-draft");
assert.equal(created.length, 1);
assert.equal(created[0]?.key, "new-draft");
assert.equal(created[0]?.playbook?.id, "pb-1");

const savedCards: { key: string; playbook: { id: string } | null }[] = [
  { key: "old", playbook: { id: "old" } },
];
const prepended = mergeSavedPlaybookCard(savedCards, { id: "pb-1" }, "new-draft");
assert.equal(prepended.length, 2);
assert.equal(prepended[0]?.key, "new-draft");
assert.equal(prepended[1]?.key, "old");

const updated = mergeSavedPlaybookCard(created, { id: "pb-1" }, "other");
assert.equal(updated.length, 1);
assert.equal(updated[0]?.key, "new-draft");
