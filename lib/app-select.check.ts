import assert from "node:assert/strict";
import { createElement } from "react";
import { optionsFromChildren } from "../components/app-select";

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
console.log("app-select.check ok");
