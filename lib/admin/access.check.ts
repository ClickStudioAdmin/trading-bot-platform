import assert from "node:assert/strict";
import {
  emailIsListedAdmin,
  listedAdminEmails,
  loginIsAdmin,
  loginSeesRestrictedExchanges,
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
  loginSeesRestrictedExchanges({ role: "developer", email: "dev@example.com" }),
  true,
);
assert.equal(
  loginSeesRestrictedExchanges({ role: "member", email: "member@example.com" }),
  false,
);
assert.equal(
  loginIsAdmin({ role: "developer", email: "dev@example.com" }),
  false,
);

console.log("admin access checks passed");
