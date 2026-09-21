import assert from "node:assert/strict";
import {
  compareTableNum,
  compareTableText,
  formatStatusLabel,
  parseTablePage,
  parseTableSortKey,
  sliceTablePage,
  statusToneFor,
  tablePageLabel,
  tablePageWindow,
  tableFiltersSuggestOpen,
  tableSortHref,
  toggleTableSortDir,
} from "./table-chrome";

assert.deepEqual(tablePageWindow(24, 1), {
  page: 1,
  pageCount: 2,
  total: 24,
  from: 1,
  to: 20,
  start: 0,
  end: 20,
});
assert.equal(tablePageLabel({ total: 0, from: 0, to: 0 }), "No rows.");
assert.equal(
  tablePageLabel({ total: 24, from: 11, to: 20 }),
  "Showing 11–20 of 24",
);
assert.equal(parseTablePage("2"), 2);
assert.equal(parseTablePage("nope"), 1);
assert.equal(toggleTableSortDir("name", "name", "asc"), "desc");
assert.equal(toggleTableSortDir("name", "status", "asc"), "asc");
assert.ok(compareTableText("b", "a", "asc") > 0);
assert.ok(compareTableNum(2, 9, "desc") > 0);
assert.equal(sliceTablePage(["a", "b", "c"], 2, 2).rows.join(""), "c");
assert.equal(statusToneFor("active"), "success");
assert.equal(statusToneFor("Unpaid"), "warning");
assert.equal(statusToneFor("error"), "danger");
assert.equal(statusToneFor("archived"), "muted");
assert.equal(statusToneFor("reduce_only"), "warning");
assert.equal(statusToneFor("stop_adding"), "warning");
assert.equal(statusToneFor("info"), "muted");
assert.equal(formatStatusLabel("paid"), "Paid");
assert.equal(formatStatusLabel("sign_up"), "Sign Up");
assert.equal(parseTableSortKey("name", ["name", "date"] as const, "date"), "name");
assert.equal(parseTableSortKey("nope", ["name", "date"] as const, "date"), "date");
assert.equal(
  tableSortHref({
    pathname: "/admin/members",
    params: { q: "ada" },
    key: "name",
    currentKey: "created",
    currentDir: "desc",
    defaultKey: "created",
    defaultDir: "desc",
  }),
  "/admin/members?q=ada&sort=name",
);

assert.equal(tableFiltersSuggestOpen({ desk: "desk-1", page: "2" }), false);
assert.equal(tableFiltersSuggestOpen({ desk: "desk-1", q: "BTC" }), true);
assert.equal(
  tableFiltersSuggestOpen(new URLSearchParams("sort=cap&dir=desc")),
  false,
);
assert.equal(tableFiltersSuggestOpen({ q: "  " }), false);
assert.equal(tableFiltersSuggestOpen({ status: "unread" }), true);
assert.equal(tableFiltersSuggestOpen({ paperError: "x" }), false);
assert.equal(tableFiltersSuggestOpen({ bot: "pb-1" }), true);

console.log("table-chrome checks passed");
