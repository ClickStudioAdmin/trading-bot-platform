import assert from "node:assert/strict";
import {
  PAPER_CLOSED_COLUMN_DEFAULTS,
  PAPER_CLOSED_LOCKED_COLUMN_COUNT,
  PAPER_OPEN_COLUMN_DEFAULTS,
  PAPER_OPEN_LOCKED_COLUMN_COUNT,
  paperClosedColumnCount,
  paperOpenColumnCount,
  parsePaperClosedColumns,
  parsePaperOpenColumns,
  parseStoredPaperOpenColumns,
} from "./columns";

assert.deepEqual(parsePaperOpenColumns(null), PAPER_OPEN_COLUMN_DEFAULTS);
assert.deepEqual(parsePaperOpenColumns("nope"), PAPER_OPEN_COLUMN_DEFAULTS);
assert.equal(parsePaperOpenColumns({ dte: false }).dte, false);
assert.equal(parsePaperOpenColumns({ dte: false }).value, true);
assert.equal(parsePaperOpenColumns({ dte: "off" }).dte, true);
assert.equal(parsePaperOpenColumns({ unknown: false }).apr, true);

assert.deepEqual(
  parseStoredPaperOpenColumns(null),
  PAPER_OPEN_COLUMN_DEFAULTS,
);
assert.deepEqual(
  parseStoredPaperOpenColumns("{not json"),
  PAPER_OPEN_COLUMN_DEFAULTS,
);
assert.equal(
  parseStoredPaperOpenColumns(JSON.stringify({ apr: false, pnl: false })).apr,
  false,
);

assert.equal(
  paperOpenColumnCount(PAPER_OPEN_COLUMN_DEFAULTS),
  PAPER_OPEN_LOCKED_COLUMN_COUNT + 7,
);
assert.equal(
  paperOpenColumnCount({
    ...PAPER_OPEN_COLUMN_DEFAULTS,
    dte: false,
    value: false,
  }),
  PAPER_OPEN_LOCKED_COLUMN_COUNT + 5,
);

assert.equal(parsePaperClosedColumns({ source: false }).source, false);
assert.equal(parsePaperClosedColumns({ source: false }).pnl, true);
assert.equal(
  paperClosedColumnCount(PAPER_CLOSED_COLUMN_DEFAULTS),
  PAPER_CLOSED_LOCKED_COLUMN_COUNT + 7,
);
assert.equal(
  paperClosedColumnCount({
    ...PAPER_CLOSED_COLUMN_DEFAULTS,
    source: false,
    pnl: false,
  }),
  PAPER_CLOSED_LOCKED_COLUMN_COUNT + 5,
);

console.log("paper columns checks passed");
