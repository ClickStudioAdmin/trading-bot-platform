import assert from "node:assert/strict";
import { FUTURES_PATHS } from "../strategies/registry";
import { safeFuturesReturnPath } from "./path";

assert.equal(safeFuturesReturnPath("/evil"), FUTURES_PATHS.positions);
assert.equal(
  safeFuturesReturnPath(FUTURES_PATHS.root),
  FUTURES_PATHS.root,
);
assert.equal(
  safeFuturesReturnPath(
    `${FUTURES_PATHS.positions}?desk=11111111-1111-4111-8111-111111111111`,
  ),
  `${FUTURES_PATHS.positions}?desk=11111111-1111-4111-8111-111111111111`,
);
assert.equal(
  safeFuturesReturnPath(
    `${FUTURES_PATHS.webhooks}?desk=11111111-1111-4111-8111-111111111111&paper=opened`,
  ),
  `${FUTURES_PATHS.webhooks}?desk=11111111-1111-4111-8111-111111111111`,
);

console.log("futures path checks passed");
