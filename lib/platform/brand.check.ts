import assert from "node:assert/strict";
import {
  composeEmailFrom,
  DEFAULT_PLATFORM_NAME,
  parsePlatformLogoUpload,
  parsePlatformName,
} from "./brand";

assert.equal(parsePlatformName("  Alpha Desks  "), "Alpha Desks");
assert.equal(parsePlatformName(""), null);
assert.equal(parsePlatformName("Alpha:Desks"), null);
assert.equal(parsePlatformName("Alpha <Desks>"), null);
assert.equal(parsePlatformName("A".repeat(81)), null);
assert.equal(parsePlatformName("A".repeat(80)), "A".repeat(80));
assert.equal(DEFAULT_PLATFORM_NAME, "Trading Bot Platform");

assert.equal(
  composeEmailFrom("Alpha Desks", "system@alphadesks.app"),
  "Alpha Desks <system@alphadesks.app>",
);
assert.equal(
  composeEmailFrom("Alpha Desks", "Ops <Ops@AlphaDesks.app>"),
  "Alpha Desks <ops@alphadesks.app>",
);

assert.equal(parsePlatformLogoUpload(null).ok, true);
assert.equal(parsePlatformLogoUpload({ name: "", type: "", size: 0 }).ok, true);
assert.equal(
  parsePlatformLogoUpload({
    name: "logo.png",
    type: "image/png",
    size: 12,
  }).ok,
  true,
);
assert.equal(
  parsePlatformLogoUpload({
    name: "logo.gif",
    type: "image/gif",
    size: 12,
  }).ok,
  false,
);

console.log("platform brand checks passed");
