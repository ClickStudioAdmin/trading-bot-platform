import assert from "node:assert/strict";
import { parseMemberForm, parseMemberId } from "./form";

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

console.log("member form checks passed");
