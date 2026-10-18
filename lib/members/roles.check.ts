import assert from "node:assert/strict";
import {
  MEMBER_ROLE_CREDENTIALS,
  parseMembersAreaTab,
} from "./roles";

assert.equal(parseMembersAreaTab(null), "members");
assert.equal(parseMembersAreaTab(""), "members");
assert.equal(parseMembersAreaTab("roles"), "roles");
assert.equal(parseMembersAreaTab("admin"), "members");

assert.deepEqual(
  MEMBER_ROLE_CREDENTIALS.map((row) => row.role),
  ["member", "developer", "admin"],
);

for (const row of MEMBER_ROLE_CREDENTIALS) {
  assert.ok(row.credentials.length > 0);
}

const member = MEMBER_ROLE_CREDENTIALS[0]!;
const developer = MEMBER_ROLE_CREDENTIALS[1]!;
const admin = MEMBER_ROLE_CREDENTIALS[2]!;

assert.equal(
  member.credentials.some((line) => line.includes("stay hidden")),
  true,
);
assert.equal(
  developer.credentials.some((line) => line.includes("In Development")),
  true,
);
assert.equal(
  developer.credentials.some((line) => line.includes("admin area stays closed")),
  true,
);
assert.equal(
  admin.credentials.some((line) => line.includes("admin area")),
  true,
);

console.log("members roles ok");
