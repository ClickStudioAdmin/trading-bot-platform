import assert from "node:assert/strict";
import {
  AUTOMATIONS_COLUMN_DEFAULTS,
  parseAutomationsColumns,
  parseStoredAutomationsColumns,
} from "./automations-columns";

assert.deepEqual(parseAutomationsColumns(null), AUTOMATIONS_COLUMN_DEFAULTS);
assert.deepEqual(parseAutomationsColumns("nope"), AUTOMATIONS_COLUMN_DEFAULTS);
assert.equal(parseAutomationsColumns({ recipe: false }).recipe, false);
assert.equal(parseAutomationsColumns({ recipe: false }).status, true);
assert.equal(parseAutomationsColumns({ recipe: "off" }).recipe, true);
assert.equal(parseAutomationsColumns({ unknown: false }).pair, true);

assert.deepEqual(
  parseStoredAutomationsColumns(null),
  AUTOMATIONS_COLUMN_DEFAULTS,
);
assert.deepEqual(
  parseStoredAutomationsColumns("{not json"),
  AUTOMATIONS_COLUMN_DEFAULTS,
);
assert.equal(
  parseStoredAutomationsColumns(
    JSON.stringify({ pair: false, performance: false }),
  ).pair,
  false,
);

console.log("automations columns checks passed");
