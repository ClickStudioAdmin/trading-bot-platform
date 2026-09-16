import assert from "node:assert/strict";
import {
  INBOX_PAGE_SIZE,
  inboxPageLabel,
  inboxPageWindow,
  inboxPath,
  parseInboxPage,
} from "./inbox";

assert.equal(INBOX_PAGE_SIZE, 20);
assert.equal(parseInboxPage("2"), 2);
assert.equal(parseInboxPage("0"), 1);
assert.equal(parseInboxPage("-3"), 1);
assert.equal(parseInboxPage("nope"), 1);
assert.equal(parseInboxPage(undefined), 1);

assert.deepEqual(inboxPageWindow(0, 4), {
  page: 1,
  pageCount: 1,
  total: 0,
  from: 0,
  to: 0,
  start: 0,
  end: 0,
});
assert.deepEqual(inboxPageWindow(45, 2), {
  page: 2,
  pageCount: 3,
  total: 45,
  from: 21,
  to: 40,
  start: 20,
  end: 40,
});
assert.deepEqual(inboxPageWindow(45, 99), {
  page: 3,
  pageCount: 3,
  total: 45,
  from: 41,
  to: 45,
  start: 40,
  end: 45,
});

assert.equal(inboxPageLabel({ total: 0, from: 0, to: 0 }), "No notices.");
assert.equal(
  inboxPageLabel({ total: 45, from: 21, to: 40 }),
  "Showing 21–40 of 45",
);

assert.equal(inboxPath(1), "/account/notifications");
assert.equal(inboxPath(2), "/account/notifications?page=2");
assert.equal(inboxPath(0), "/account/notifications");

console.log("notification inbox checks passed");
