import assert from "node:assert/strict";
import {
  FUTURES_DCA_OPEN_COLUMN_COUNT,
  FUTURES_OPEN_COLUMN_DEFAULTS,
  FUTURES_OPEN_LOCKED_COLUMN_COUNT,
  futuresOpenColumnCount,
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
