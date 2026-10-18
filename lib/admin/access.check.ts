import assert from "node:assert/strict";
import {
  emailIsListedAdmin,
  exchangePreviewForLogin,
  listedAdminEmails,
  loginIsAdmin,
} from "./emails";

assert.deepEqual(listedAdminEmails(), ["click.studio.admin@gmail.com"]);
assert.equal(emailIsListedAdmin("click.studio.admin@gmail.com"), true);
assert.equal(emailIsListedAdmin("Click.Studio.Admin@gmail.com"), true);
assert.equal(emailIsListedAdmin("nobody@example.com"), false);
assert.equal(emailIsListedAdmin(undefined), false);
assert.equal(
  loginIsAdmin({ role: "admin", email: "member@example.com" }),
  true,
);
assert.equal(
  loginIsAdmin({ role: "member", email: "click.studio.admin@gmail.com" }),
  true,
);
assert.equal(
  loginIsAdmin({ role: "member", email: "member@example.com" }),
  false,
);
assert.equal(loginIsAdmin({ role: null, email: null }), false);
assert.equal(
  exchangePreviewForLogin({ role: "developer", email: "dev@example.com" }),
  "development",
);
assert.equal(
  exchangePreviewForLogin({ role: "platform_tester", email: "qa@example.com" }),
  "testing",
);
assert.equal(
  exchangePreviewForLogin({ role: "member", email: "member@example.com" }),
  "public",
);
assert.equal(
  exchangePreviewForLogin({ role: "admin", email: "member@example.com" }),
  "development",
);
assert.equal(
  exchangePreviewForLogin({
    role: "platform_tester",
    email: "click.studio.admin@gmail.com",
  }),
  "development",
);
assert.equal(
  loginIsAdmin({ role: "developer", email: "dev@example.com" }),
  false,
);
assert.equal(
  loginIsAdmin({ role: "platform_tester", email: "qa@example.com" }),
  false,
);

console.log("admin access checks passed");
