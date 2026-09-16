import assert from "node:assert/strict";
import {
  memberNeedsCardUpdate,
  noticeAddressShort,
  noticeDate,
  payoutBookLabel,
} from "./commercial";

assert.equal(noticeDate("2026-09-16T12:00:00.000Z"), "2026-09-16");
assert.equal(noticeDate(null), "—");
assert.equal(noticeDate("not-a-date"), "—");

assert.equal(noticeAddressShort("0xabc"), "0xabc");
assert.equal(noticeAddressShort(""), "—");
assert.equal(
  noticeAddressShort("0x1234567890abcdef1234567890abcdef12345678"),
  "0x1234…5678",
);

assert.equal(payoutBookLabel("main"), "Account Balance");
assert.equal(payoutBookLabel("affiliate"), "Affiliate book");

assert.equal(
  memberNeedsCardUpdate({
    billingMethod: "stripe",
    subscriptionStatus: "past_due",
  }),
  true,
);
assert.equal(
  memberNeedsCardUpdate({
    billingMethod: "wallet",
    subscriptionStatus: "past_due",
  }),
  false,
);
assert.equal(
  memberNeedsCardUpdate({
    billingMethod: "stripe",
    subscriptionStatus: "active",
  }),
  false,
);
assert.equal(
  memberNeedsCardUpdate({
    billingMethod: null,
    subscriptionStatus: "past_due",
  }),
  false,
);

console.log("notification commercial checks passed");
