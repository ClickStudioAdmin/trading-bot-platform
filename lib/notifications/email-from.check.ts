import assert from "node:assert/strict";
import {
  DEFAULT_SYSTEM_FROM,
  DEFAULT_TEST_INBOX,
  parseEmailFrom,
  parseMailbox,
  parsePlatformLogoUrl,
  resolveEmailFrom,
} from "./email-from";

assert.equal(parseMailbox("System@AlphaDesks.app"), "system@alphadesks.app");
assert.equal(parseMailbox("not-an-email"), null);
assert.equal(parseMailbox(""), null);
assert.equal(DEFAULT_TEST_INBOX, "system@alphadesks.app");

assert.equal(
  parseEmailFrom("Trading Bot Platform <system@alphadesks.app>"),
  "Trading Bot Platform <system@alphadesks.app>",
);
assert.equal(
  parseEmailFrom("  Trading Bot Platform <System@AlphaDesks.app>  "),
  "Trading Bot Platform <system@alphadesks.app>",
);
assert.equal(parseEmailFrom("system@alphadesks.app"), "system@alphadesks.app");
assert.equal(parseEmailFrom("<>"), null);
assert.equal(parseEmailFrom("Name <>"), null);
assert.equal(parseEmailFrom("<system@alphadesks.app>"), null);

assert.equal(
  resolveEmailFrom({ stored: null, env: null }),
  DEFAULT_SYSTEM_FROM,
);
assert.equal(
  resolveEmailFrom({
    stored: "Desk <ops@alphadesks.app>",
    env: "Trading Bot Platform <noreply@example.com>",
  }),
  "Desk <ops@alphadesks.app>",
);
assert.equal(
  resolveEmailFrom({
    stored: "bad",
    env: "Trading Bot Platform <noreply@example.com>",
  }),
  "Trading Bot Platform <noreply@example.com>",
);

assert.equal(parsePlatformLogoUrl(""), null);
assert.equal(parsePlatformLogoUrl("not-a-url"), null);
assert.equal(
  parsePlatformLogoUrl("https://cdn.example.com/logo.png"),
  "https://cdn.example.com/logo.png",
);

console.log("email-from checks passed");
