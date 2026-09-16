import assert from "node:assert/strict";
import {
  isAffiliatePortalPath,
  isAppChromePath,
  isIdentityPath,
  usesSignedInAppChrome,
} from "./site-links";

assert.equal(isAppChromePath("/account"), true);
assert.equal(isAppChromePath("/account/settings"), true);
assert.equal(isAppChromePath("/affiliates"), false);
assert.equal(isAffiliatePortalPath("/affiliates"), true);
assert.equal(isAffiliatePortalPath("/affiliates?tab=network"), false);
assert.equal(usesSignedInAppChrome("/affiliates", false), false);
assert.equal(usesSignedInAppChrome("/affiliates", true), true);
assert.equal(usesSignedInAppChrome("/account/settings", true), true);
assert.equal(usesSignedInAppChrome("/", true), false);
assert.equal(usesSignedInAppChrome("/pricing", true), false);
assert.equal(isIdentityPath("/account/verify"), true);
assert.equal(isIdentityPath("/forgot-password"), true);
assert.equal(isIdentityPath("/reset-password"), true);
assert.equal(isIdentityPath("/verify-email"), true);
assert.equal(usesSignedInAppChrome("/account/verify", true), false);
assert.equal(usesSignedInAppChrome("/forgot-password", true), false);
