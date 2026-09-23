import assert from "node:assert/strict";
import { createElement } from "react";
import { optionsFromChildren, selectPanelBox } from "../components/app-select";

const rows = optionsFromChildren([
  createElement("option", { value: "", key: "all" }, "All"),
  createElement("option", { value: "long", key: "long" }, "Long"),
  createElement("option", { value: "short", disabled: true, key: "short" }, "Short"),
]);

assert.deepEqual(rows, [
  { value: "", label: "All", disabled: false },
  { value: "long", label: "Long", disabled: false },
  { value: "short", label: "Short", disabled: true },
]);
assert.deepEqual(optionsFromChildren(null), []);

const grouped = optionsFromChildren([
  createElement(
    "optgroup",
    { label: "Desk", key: "desk" },
    createElement("option", { value: "bot-1", key: "bot-1" }, "DCA bot"),
  ),
  createElement(
    "optgroup",
    { label: "Templates", key: "templates" },
    createElement("option", { value: "tpl-1", key: "tpl-1" }, "ETH grid"),
  ),
]);
assert.deepEqual(grouped, [
  { value: "bot-1", label: "DCA bot", disabled: false, group: "Desk" },
  { value: "tpl-1", label: "ETH grid", disabled: false, group: "Templates" },
]);
const shortMenu = selectPanelBox({
  top: 640,
  bottom: 676,
  left: 40,
  width: 160,
  panelHeight: 72,
  viewportWidth: 1280,
  viewportHeight: 800,
});
assert.equal(shortMenu.top, 680);
assert.equal(shortMenu.maxHeight, 112);

const flipped = selectPanelBox({
  top: 640,
  bottom: 676,
  left: 40,
  width: 160,
  panelHeight: 200,
  viewportWidth: 1280,
  viewportHeight: 800,
});
assert.equal(flipped.top, 436);
assert.equal(flipped.maxHeight, 224);

console.log("app-select.check ok");
