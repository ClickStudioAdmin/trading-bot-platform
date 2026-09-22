import assert from "node:assert/strict";
import {
  FUTURES_CLOSED_COLUMN_DEFAULTS,
  FUTURES_CLOSED_LOCKED_COLUMN_COUNT,
  FUTURES_DCA_OPEN_COLUMN_COUNT,
  FUTURES_OPEN_COLUMN_DEFAULTS,
  FUTURES_OPEN_LOCKED_COLUMN_COUNT,
  FUTURES_WORKING_COLUMN_DEFAULTS,
  FUTURES_WORKING_LOCKED_COLUMN_COUNT,
  futuresClosedColumnCount,
  futuresOpenColumnCount,
  futuresWorkingColumnCount,
  parseFuturesClosedColumns,
  parseFuturesOpenColumns,
  parseStoredFuturesOpenColumns,
} from "./columns";

assert.deepEqual(parseFuturesOpenColumns(null), FUTURES_OPEN_COLUMN_DEFAULTS);
assert.deepEqual(parseFuturesOpenColumns("nope"), FUTURES_OPEN_COLUMN_DEFAULTS);
assert.equal(parseFuturesOpenColumns({ qty: false }).qty, false);
assert.equal(parseFuturesOpenColumns({ qty: false }).leverage, true);
assert.equal(parseFuturesOpenColumns({ qty: "off" }).qty, true);
assert.equal(parseFuturesOpenColumns({ unknown: false }).value, true);

assert.deepEqual(
  parseStoredFuturesOpenColumns(null),
  FUTURES_OPEN_COLUMN_DEFAULTS,
);
assert.deepEqual(
  parseStoredFuturesOpenColumns("{not json"),
  FUTURES_OPEN_COLUMN_DEFAULTS,
);
assert.equal(
  parseStoredFuturesOpenColumns(JSON.stringify({ liq: false, trailing: false }))
    .liq,
  false,
);

assert.equal(
  futuresOpenColumnCount(FUTURES_OPEN_COLUMN_DEFAULTS),
  FUTURES_OPEN_LOCKED_COLUMN_COUNT + 10,
);
assert.equal(
  futuresOpenColumnCount({
    ...FUTURES_OPEN_COLUMN_DEFAULTS,
    qty: false,
    value: false,
  }),
  FUTURES_OPEN_LOCKED_COLUMN_COUNT + 8,
);
assert.equal(
  futuresOpenColumnCount(
    FUTURES_OPEN_COLUMN_DEFAULTS,
    FUTURES_DCA_OPEN_COLUMN_COUNT,
  ),
  FUTURES_OPEN_LOCKED_COLUMN_COUNT + 10 + FUTURES_DCA_OPEN_COLUMN_COUNT,
);

assert.equal(parseFuturesClosedColumns({ source: false }).source, false);
assert.equal(parseFuturesClosedColumns({ source: false }).roe, true);
assert.equal(
  futuresClosedColumnCount(FUTURES_CLOSED_COLUMN_DEFAULTS),
  FUTURES_CLOSED_LOCKED_COLUMN_COUNT + 8,
);
assert.equal(
  futuresClosedColumnCount({
    ...FUTURES_CLOSED_COLUMN_DEFAULTS,
    source: false,
    roe: false,
  }),
  FUTURES_CLOSED_LOCKED_COLUMN_COUNT + 6,
);

assert.equal(
  futuresWorkingColumnCount(FUTURES_WORKING_COLUMN_DEFAULTS),
  FUTURES_WORKING_LOCKED_COLUMN_COUNT + 9,
);
assert.equal(
  futuresWorkingColumnCount(
    { ...FUTURES_WORKING_COLUMN_DEFAULTS, tpsl: false, trailing: false },
    1,
  ),
  FUTURES_WORKING_LOCKED_COLUMN_COUNT + 7 + 1,
);
