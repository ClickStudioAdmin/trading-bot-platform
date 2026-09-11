import assert from "node:assert/strict";
import { parseMemberForm, parseMemberId, parseOwnPasswordChange, parseOwnProfile } from "./form";

const create = new FormData();
create.set("name", " Desk Trader ");
create.set("email", "Trader@Click.studio");
create.set("password", "password1");
create.set("role", "member");
create.set("status", "active");
create.set("planId", "00000000-0000-4000-8000-000000000001");
const created = parseMemberForm(create, "create");
assert.equal(created.ok, true);
if (created.ok) {
  assert.equal(created.values.name, "Desk Trader");
  assert.equal(created.values.email, "trader@click.studio");
  assert.equal(created.values.planId, "00000000-0000-4000-8000-000000000001");
}

const shortPassword = new FormData();
shortPassword.set("name", "Desk Trader");
shortPassword.set("email", "trader@click.studio");
shortPassword.set("password", "short");
shortPassword.set("role", "member");
shortPassword.set("status", "active");
shortPassword.set("planId", "00000000-0000-4000-8000-000000000001");
const rejected = parseMemberForm(shortPassword, "create");
assert.equal(rejected.ok, false);

const edit = new FormData();
edit.set("name", "Desk Trader");
edit.set("email", "trader@click.studio");
edit.set("password", "");
edit.set("role", "admin");
edit.set("status", "disabled");
edit.set("planId", "00000000-0000-4000-8000-000000000001");
const edited = parseMemberForm(edit, "edit");
assert.equal(edited.ok, true);

const listed = new FormData();
listed.set("name", "Click");
listed.set("email", "click.studio.admin@gmail.com");
listed.set("password", "");
listed.set("role", "member");
listed.set("status", "disabled");
listed.set("planId", "00000000-0000-4000-8000-000000000001");
const forced = parseMemberForm(listed, "edit");
assert.equal(forced.ok, true);
if (forced.ok) {
  assert.equal(forced.values.role, "admin");
  assert.equal(forced.values.status, "active");
}

const noPlan = new FormData();
noPlan.set("name", "Desk Trader");
noPlan.set("email", "trader@click.studio");
noPlan.set("password", "password1");
noPlan.set("role", "member");
noPlan.set("status", "active");
assert.equal(parseMemberForm(noPlan, "create").ok, false);

assert.equal(parseMemberId("12"), 12);
assert.equal(parseMemberId("nope"), null);

const profile = new FormData();
profile.set("name", " Click ");
const named = parseOwnProfile(profile);
assert.equal(named.ok, true);
if (named.ok) {
  assert.equal(named.name, "Click");
  assert.equal(named.paySubscriptionFromAffiliate, false);
}
const deduct = new FormData();
deduct.set("name", "Click");
deduct.set("paySubscriptionFromAffiliate", "1");
const deducted = parseOwnProfile(deduct);
assert.equal(deducted.ok, true);
if (deducted.ok) {
  assert.equal(deducted.paySubscriptionFromAffiliate, true);
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
