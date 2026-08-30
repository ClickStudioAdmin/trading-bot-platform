import assert from "node:assert/strict";
import { emailIsListedAdmin, listedAdminEmails } from "./emails";

assert.deepEqual(listedAdminEmails(), ["click.studio.admin@gmail.com"]);
assert.equal(emailIsListedAdmin("click.studio.admin@gmail.com"), true);
assert.equal(emailIsListedAdmin("Click.Studio.Admin@gmail.com"), true);
assert.equal(emailIsListedAdmin("nobody@example.com"), false);
assert.equal(emailIsListedAdmin(undefined), false);

console.log("admin access checks passed");
