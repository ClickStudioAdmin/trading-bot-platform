import assert from "node:assert/strict";
import {
  DEFAULT_MEMBER_QUERY,
  memberListHref,
  parseMemberListQuery,
  toggleMemberSort,
} from "./query";

const parsed = parseMemberListQuery({
  q: " click% ",
  role: "admin",
  status: ["disabled", "active"],
  sort: "email",
  dir: "asc",
  page: "3",
});
assert.equal(parsed.q, "click");
assert.equal(parsed.role, "admin");
assert.equal(parsed.status, "disabled");
assert.equal(parsed.sort, "email");
assert.equal(parsed.dir, "asc");
assert.equal(parsed.page, 3);

const ignored = parseMemberListQuery({
  role: "owner",
  status: "banned",
  sort: "password",
  dir: "sideways",
  page: "0",
});
assert.deepEqual(ignored, DEFAULT_MEMBER_QUERY);

assert.equal(memberListHref(DEFAULT_MEMBER_QUERY), "/admin/members");
assert.equal(
  memberListHref(parsed),
  "/admin/members?q=click&role=admin&status=disabled&sort=email&dir=asc&page=3",
);

const toggled = toggleMemberSort(parsed, "email");
assert.equal(toggled.dir, "desc");
assert.equal(toggled.page, 1);
const switched = toggleMemberSort(parsed, "name");
assert.equal(switched.sort, "name");
assert.equal(switched.dir, "asc");

console.log("member query checks passed");
