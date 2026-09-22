import assert from "node:assert/strict";
import {
  columnPickerLabel,
  countPickedColumns,
  parseColumnFlags,
  parseStoredColumnFlags,
} from "./table-columns";

const ids = ["a", "b", "c"] as const;
const defaults = { a: true, b: true, c: false };

assert.deepEqual(parseColumnFlags(null, ids, defaults), defaults);
assert.deepEqual(parseColumnFlags("nope", ids, defaults), defaults);
assert.equal(parseColumnFlags({ a: false }, ids, defaults).a, false);
assert.equal(parseColumnFlags({ a: false }, ids, defaults).b, true);
assert.equal(parseColumnFlags({ a: "off" }, ids, defaults).a, true);
assert.equal(parseColumnFlags({ unknown: false }, ids, defaults).c, false);

assert.deepEqual(parseStoredColumnFlags(null, ids, defaults), defaults);
assert.deepEqual(parseStoredColumnFlags("{not json", ids, defaults), defaults);
assert.equal(
  parseStoredColumnFlags(JSON.stringify({ b: false, c: true }), ids, defaults).c,
  true,
);

const columns = ids.map((id) => ({ id }));
assert.deepEqual(countPickedColumns(columns, defaults), {
  selected: 2,
  total: 3,
});
assert.equal(columnPickerLabel(10, 15), "Columns (10 / 15)");
assert.equal(columnPickerLabel(15, 15), "Columns");
assert.equal(columnPickerLabel(0, 0), "Columns");

console.log("table columns checks passed");
