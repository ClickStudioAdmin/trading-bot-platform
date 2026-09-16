import assert from "node:assert/strict";
import {
  ACCOUNT_HOME_PATH,
  AFFILIATES_PATH,
  FORGOT_PASSWORD_PATH,
  pathAllowsAffiliateOnly,
  pathAllowsUnverified,
  RESET_PASSWORD_PATH,
  SIGN_UP_PATH,
  VERIFY_EMAIL_PATH,
  VERIFY_PATH,
} from "./onboarding-path";

assert.equal(ACCOUNT_HOME_PATH, "/account");
assert.equal(VERIFY_PATH, "/account/verify");
assert.equal(SIGN_UP_PATH, "/sign-up");
assert.equal(pathAllowsUnverified("/account/verify"), true);
assert.equal(pathAllowsUnverified("/verify-email"), true);
assert.equal(pathAllowsUnverified("/forgot-password"), true);
assert.equal(pathAllowsUnverified("/reset-password"), true);
assert.equal(pathAllowsUnverified("/sign-in"), true);
assert.equal(pathAllowsUnverified("/sign-up"), true);
assert.equal(pathAllowsUnverified("/pricing"), true);
assert.equal(pathAllowsUnverified("/r/AB12CD"), true);
assert.equal(pathAllowsUnverified("/"), true);
assert.equal(pathAllowsUnverified("/account"), false);
assert.equal(pathAllowsUnverified("/welcome"), false);
assert.equal(pathAllowsUnverified("/affiliates"), false);
assert.equal(pathAllowsUnverified("/admin"), false);
assert.equal(pathAllowsUnverified("/strategies"), false);
assert.equal(pathAllowsUnverified("/api/tick"), true);
assert.equal(pathAllowsAffiliateOnly("/affiliates"), true);
assert.equal(pathAllowsAffiliateOnly("/r/AB12CD"), true);
assert.equal(pathAllowsAffiliateOnly("/sign-up"), true);
assert.equal(pathAllowsAffiliateOnly("/account/settings"), true);
assert.equal(pathAllowsAffiliateOnly("/account/notifications"), true);
assert.equal(pathAllowsAffiliateOnly("/account/verify"), true);
assert.equal(pathAllowsAffiliateOnly(FORGOT_PASSWORD_PATH), true);
assert.equal(pathAllowsAffiliateOnly(RESET_PASSWORD_PATH), true);
assert.equal(pathAllowsAffiliateOnly(VERIFY_EMAIL_PATH), true);
assert.equal(pathAllowsAffiliateOnly("/account"), false);
assert.equal(pathAllowsAffiliateOnly("/account/billing"), false);
assert.equal(AFFILIATES_PATH, "/affiliates");

console.log("onboarding path checks passed");
