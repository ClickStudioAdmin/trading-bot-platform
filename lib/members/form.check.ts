import assert from "node:assert/strict";
import { parseMemberForm, parseMemberId, parseOwnPasswordChange, parseOwnProfile } from "./form";

const create = new FormData();
create.set("name", " Desk Trader ");
create.set("email", "Trader@Click.studio");
create.set("password", "password1");
create.set("role", "member");
create.set("status", "active");
const created = parseMemberForm(create, "create");
assert.equal(created.ok, true);
if (created.ok) {
  assert.equal(created.values.name, "Desk Trader");
  assert.equal(created.values.email, "trader@click.studio");
}

const shortPassword = new FormData();
shortPassword.set("name", "Desk Trader");
shortPassword.set("email", "trader@click.studio");
shortPassword.set("password", "short");
shortPassword.set("role", "member");
shortPassword.set("status", "active");
const rejected = parseMemberForm(shortPassword, "create");
assert.equal(rejected.ok, false);

const edit = new FormData();
edit.set("name", "Desk Trader");
edit.set("email", "trader@click.studio");
edit.set("password", "");
edit.set("role", "admin");
edit.set("status", "disabled");
const edited = parseMemberForm(edit, "edit");
assert.equal(edited.ok, true);

const listed = new FormData();
listed.set("name", "Click");
listed.set("email", "click.studio.admin@gmail.com");
listed.set("password", "");
listed.set("role", "member");
listed.set("status", "disabled");
const forced = parseMemberForm(listed, "edit");
assert.equal(forced.ok, true);
if (forced.ok) {
  assert.equal(forced.values.role, "admin");
  assert.equal(forced.values.status, "active");
}

assert.equal(parseMemberId("12"), 12);
assert.equal(parseMemberId("nope"), null);

const profile = new FormData();
profile.set("name", " Click ");
const named = parseOwnProfile(profile);
assert.equal(named.ok, true);
if (named.ok) {
  assert.equal(named.name, "Click");
}
assert.equal(parseOwnProfile(new FormData()).ok, false);

const passwordOk = new FormData();
passwordOk.set("currentPassword", "password1");
passwordOk.set("newPassword", "password2");
passwordOk.set("confirmPassword", "password2");
const changed = parseOwnPasswordChange(passwordOk);
assert.equal(changed.ok, true);

const mismatch = new FormData();
mismatch.set("currentPassword", "password1");
mismatch.set("newPassword", "password2");
mismatch.set("confirmPassword", "password3");
assert.equal(parseOwnPasswordChange(mismatch).ok, false);

const same = new FormData();
same.set("currentPassword", "password1");
same.set("newPassword", "password1");
same.set("confirmPassword", "password1");
assert.equal(parseOwnPasswordChange(same).ok, false);

console.log("member form checks passed");
