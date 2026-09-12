import assert from "node:assert/strict";
import {
  pathAllowsAffiliateOnly,
  pathSkipsOnboarding,
  WELCOME_PATH,
} from "./onboarding-path";

assert.equal(WELCOME_PATH, "/welcome");
assert.equal(pathSkipsOnboarding("/welcome"), true);
assert.equal(pathSkipsOnboarding("/sign-in"), true);
assert.equal(pathSkipsOnboarding("/pricing"), true);
assert.equal(pathSkipsOnboarding("/affiliates"), true);
assert.equal(pathAllowsAffiliateOnly("/affiliates"), true);
assert.equal(pathAllowsAffiliateOnly("/welcome"), false);
assert.equal(pathAllowsAffiliateOnly("/account"), false);
assert.equal(pathSkipsOnboarding("/api/tick"), true);
assert.equal(pathSkipsOnboarding("/account"), false);
assert.equal(pathSkipsOnboarding("/strategies"), false);
assert.equal(pathSkipsOnboarding("/"), true);
assert.equal(pathSkipsOnboarding(""), false);
