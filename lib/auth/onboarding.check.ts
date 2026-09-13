import assert from "node:assert/strict";
import {
  pathAllowsAffiliateOnly,
  pathSkipsOnboarding,
  SIGN_UP_PATH,
  WELCOME_PATH,
} from "./onboarding-path";

assert.equal(WELCOME_PATH, "/welcome");
assert.equal(SIGN_UP_PATH, "/sign-up");
assert.equal(pathSkipsOnboarding("/welcome"), true);
assert.equal(pathSkipsOnboarding("/sign-in"), true);
assert.equal(pathSkipsOnboarding("/sign-up"), true);
assert.equal(pathSkipsOnboarding("/pricing"), true);
assert.equal(pathSkipsOnboarding("/affiliates"), true);
assert.equal(pathSkipsOnboarding("/r/AB12CD"), true);
assert.equal(pathSkipsOnboarding("/robots.txt"), false);
assert.equal(pathAllowsAffiliateOnly("/affiliates"), true);
assert.equal(pathAllowsAffiliateOnly("/r/AB12CD"), true);
assert.equal(pathAllowsAffiliateOnly("/sign-up"), true);
assert.equal(pathAllowsAffiliateOnly("/account/settings"), true);
assert.equal(pathAllowsAffiliateOnly("/welcome"), false);
assert.equal(pathAllowsAffiliateOnly("/account"), false);
assert.equal(pathAllowsAffiliateOnly("/account/billing"), false);
assert.equal(pathSkipsOnboarding("/api/tick"), true);
assert.equal(pathSkipsOnboarding("/account"), false);
assert.equal(pathSkipsOnboarding("/strategies"), false);
assert.equal(pathSkipsOnboarding("/"), true);
assert.equal(pathSkipsOnboarding(""), false);
