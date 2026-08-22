import assert from "node:assert/strict";
import { authorizeCronSecret } from "./cron";

assert.equal(authorizeCronSecret("Bearer secret-1", "secret-1"), true);
assert.equal(authorizeCronSecret("Bearer other", "secret-1"), false);
assert.equal(authorizeCronSecret(null, "secret-1"), false);
assert.equal(authorizeCronSecret("Bearer secret-1", undefined), false);

console.log("engine cron checks passed");
