import assert from "node:assert/strict";
import {
  isAffiliatePortalPath,
  isAppChromePath,
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
