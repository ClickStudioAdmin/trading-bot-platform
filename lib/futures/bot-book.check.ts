import assert from "node:assert/strict";
import { futuresBotBookQuery } from "./list";

const dca = futuresBotBookQuery({ symbol: "BTCUSDT" });
assert.deepEqual(dca.positions, { symbol: "BTCUSDT" });
assert.deepEqual(dca.working, { symbol: "BTCUSDT" });

const perps = futuresBotBookQuery({
  ruleId: "rule-1",
  ruleName: "MY DCA",
});
assert.deepEqual(perps.positions, { ruleId: "rule-1" });
assert.deepEqual(perps.working, { ruleName: "MY DCA" });

const missing = futuresBotBookQuery({ symbol: "  ", ruleId: "" });
assert.equal(missing.positions, null);
assert.equal(missing.working, null);

console.log("futures bot book checks passed");
