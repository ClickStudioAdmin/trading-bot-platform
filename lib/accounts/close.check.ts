import assert from "node:assert/strict";
import {
  addUtcMonths,
  deskCloseRetentionDue,
  deskWindDown,
  engineSkipsClosedDesk,
  oldestDueClosedDesk,
  DESK_CLOSE_RETENTION_MONTHS,
} from "./close";
import { formatDeleteBlockers } from "./model";

const flat = {
  accountCount: 2,
  openCount: 0,
  automationsRunning: false,
  hasCopyDesks: false,
  hasOpenShares: false,
  followerBooksOpen: false,
};

assert.deepEqual(deskWindDown(flat), { action: "delete" });
assert.deepEqual(
  deskWindDown({ ...flat, hasCopyDesks: true }),
  { action: "close", kind: "archive" },
);
assert.deepEqual(
  deskWindDown({ ...flat, hasCopyDesks: true, hasOpenShares: true }),
  { action: "close", kind: "archive" },
);
assert.deepEqual(
  deskWindDown({ ...flat, hasOpenShares: true }),
  { action: "close", kind: "revoke" },
);
assert.deepEqual(
  deskWindDown({ ...flat, accountCount: 1, hasCopyDesks: true }),
  { action: "blocked", blocks: ["last"] },
);
assert.deepEqual(
  deskWindDown({
    ...flat,
    hasCopyDesks: true,
    openCount: 1,
    automationsRunning: true,
  }),
  { action: "blocked", blocks: ["open", "automations"] },
);
assert.deepEqual(
  deskWindDown({ ...flat, hasCopyDesks: true, followerBooksOpen: true }),
  { action: "blocked", blocks: ["follower_open"] },
);
assert.equal(
  formatDeleteBlockers(["follower_open"]),
  "A follower still has an open position or a working order. Disable this desk and let the next tick flatten those copies",
);

assert.equal(
  engineSkipsClosedDesk({ closedAtMs: 1, parentClosedAtMs: null }),
  true,
);
assert.equal(
  engineSkipsClosedDesk({ closedAtMs: null, parentClosedAtMs: 1 }),
  true,
);
assert.equal(
  engineSkipsClosedDesk({ closedAtMs: null, parentClosedAtMs: null }),
  false,
);

const closed = Date.parse("2026-10-16T05:00:00.000Z");
const sixMonths = addUtcMonths(closed, DESK_CLOSE_RETENTION_MONTHS);
assert.equal(new Date(sixMonths).toISOString(), "2027-04-16T05:00:00.000Z");
assert.equal(deskCloseRetentionDue(closed, sixMonths - 1), false);
assert.equal(deskCloseRetentionDue(closed, sixMonths), true);
assert.equal(
  new Date(addUtcMonths(Date.parse("2026-08-31T12:00:00.000Z"), 6)).toISOString(),
  "2027-02-28T12:00:00.000Z",
);
assert.equal(
  new Date(addUtcMonths(Date.parse("2023-08-31T00:00:00.000Z"), 6)).toISOString(),
  "2024-02-29T00:00:00.000Z",
);
assert.equal(deskCloseRetentionDue(Number.NaN, sixMonths), false);
assert.equal(
  oldestDueClosedDesk(
    [
      { id: "later", closedAtMs: closed },
      { id: "earlier", closedAtMs: closed - 86_400_000 },
      { id: "fresh", closedAtMs: sixMonths },
    ],
    sixMonths,
  ),
  "earlier",
);
assert.equal(oldestDueClosedDesk([{ id: "fresh", closedAtMs: closed }], closed), null);

console.log("desk close checks passed");
