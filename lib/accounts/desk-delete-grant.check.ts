import assert from "node:assert/strict";
import {
  deskDeleteGrantAllows,
  parseDeskDeleteGrant,
  signDeskDeleteGrant,
} from "./desk-delete-grant";

const previous = process.env.SESSION_SECRET;
process.env.SESSION_SECRET = "test-session-secret";

const userId = "11111111-1111-1111-1111-111111111111";
const accountId = "22222222-2222-2222-2222-222222222222";
const now = 1_700_000_000_000;
const expires = now + 60_000;
const token = signDeskDeleteGrant(userId, accountId, expires);

assert.equal(parseDeskDeleteGrant(token, now)?.userId, userId);
assert.equal(parseDeskDeleteGrant(token, now)?.accountId, accountId);
assert.equal(deskDeleteGrantAllows(token, userId, accountId, now), true);
assert.equal(deskDeleteGrantAllows(token, userId, "other-account", now), false);
assert.equal(deskDeleteGrantAllows(token, "other-user", accountId, now), false);
assert.equal(deskDeleteGrantAllows(null, userId, accountId, now), false);
assert.equal(parseDeskDeleteGrant(token, expires), null);
assert.equal(parseDeskDeleteGrant(`${token}x`, now), null);
assert.equal(deskDeleteGrantAllows("", userId, accountId, now), false);

process.env.SESSION_SECRET = previous;

console.log("desk delete grant checks passed");
