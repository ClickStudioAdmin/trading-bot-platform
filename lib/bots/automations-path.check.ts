import assert from "node:assert/strict";
import {
  AUTOMATIONS_NEW,
  automationsEditHref,
  automationsEditTitle,
  automationsNewHref,
  automationsSavedHref,
  automationsStayEditHref,
  parseAutomationsClone,
  parseAutomationsEdit,
  parseBotHashId,
} from "./automations-path";

assert.equal(parseAutomationsEdit(undefined), null);
assert.equal(parseAutomationsEdit("  "), null);
assert.equal(parseAutomationsEdit("new"), AUTOMATIONS_NEW);
assert.equal(parseAutomationsEdit("pb-1"), "pb-1");
assert.equal(parseAutomationsClone("src-2"), "src-2");

assert.equal(parseBotHashId("#bot-pb-1"), "pb-1");
assert.equal(parseBotHashId("bot-12"), "12");
assert.equal(parseBotHashId("#bot-"), null);
assert.equal(parseBotHashId("#positions"), null);

assert.equal(
  automationsEditHref("/strategies/futures/automations?desk=desk-1", "pb-1"),
  "/strategies/futures/automations?desk=desk-1&edit=pb-1",
);
assert.equal(
  automationsNewHref("/strategies/futures/automations?desk=desk-1", "rule-9"),
  "/strategies/futures/automations?desk=desk-1&edit=new&clone=rule-9",
);
assert.equal(
  automationsSavedHref("/strategies/cash-and-carry/automations?desk=desk-1"),
  "/strategies/cash-and-carry/automations?desk=desk-1&saved=1",
);
assert.equal(
  automationsSavedHref(
    "/strategies/cash-and-carry/automations?desk=desk-1",
    "bot-9",
  ),
  "/strategies/cash-and-carry/automations?desk=desk-1&saved=1&created=bot-9",
);
assert.equal(
  automationsStayEditHref(
    "/strategies/futures/automations?desk=desk-1",
    "pb-1",
    "Bot saved.",
  ),
  "/strategies/futures/automations?desk=desk-1&edit=pb-1&saved=1&notice=Bot+saved.",
);
assert.equal(automationsEditTitle({ edit: null }), null);
assert.equal(automationsEditTitle({ edit: "new" }), "New bot");
assert.equal(
  automationsEditTitle({ edit: "pb-1", name: "ETH grid" }),
  "ETH grid",
);
