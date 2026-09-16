import assert from "node:assert/strict";
import {
  accountShortfallKey,
  copyInviteKey,
  depositCreditedKey,
  deskOrderFailedKey,
  emailDefaultOn,
  emailIsMuteable,
  emailShouldSend,
  inboxShouldInsert,
  invoiceIssuedKey,
  invoicePaidKey,
  isNotificationId,
  isOperatorNotificationId,
  memberNotificationIds,
  NOTIFICATION_IDS,
  operatorNotificationIds,
  passwordChangedKey,
  paymentFailedKey,
  payoutMemberHref,
  payoutOperatorHref,
  resendConfigured,
  emailDispatchShouldComplete,
  parseEmailDispatchClaim,
} from "./catalog";
import {
  inboxBody,
  inboxTitle,
  notificationCopy,
  sampleNotice,
  sampleOperatorNotice,
} from "./copy";

assert.equal(NOTIFICATION_IDS.length, 21);
assert.equal(isNotificationId("invoice_issued"), true);
assert.equal(isNotificationId("trade_opened"), false);
assert.equal(isOperatorNotificationId("operator_gas_low"), true);
assert.equal(isOperatorNotificationId("invoice_paid"), false);
assert.equal(emailIsMuteable("password_changed"), false);
assert.equal(emailIsMuteable("invoice_issued"), true);
assert.equal(emailDefaultOn("payment_failed"), true);
assert.equal(emailDefaultOn("invoice_issued"), false);
assert.equal(emailDefaultOn("operator_payout_requested"), true);

assert.deepEqual(
  memberNotificationIds(true).includes("desk_sync_failed"),
  false,
);
assert.equal(memberNotificationIds(true).includes("payout_paid"), true);
assert.equal(memberNotificationIds(true).includes("commission_released"), true);
assert.equal(memberNotificationIds(true).includes("password_changed"), true);
assert.equal(memberNotificationIds(true).includes("invoice_issued"), false);
assert.equal(memberNotificationIds(true).includes("account_shortfall"), false);
assert.equal(
  memberNotificationIds(false).includes("copy_invite_received"),
  true,
);
assert.equal(operatorNotificationIds().every(isOperatorNotificationId), true);

assert.deepEqual(
  emailShouldSend({
    template: "invoice_paid",
    toEmail: "a@b.com",
    platformDisabled: [],
    userDisabledEmails: [],
    resendConfigured: true,
  }),
  { send: true },
);
assert.deepEqual(
  emailShouldSend({
    template: "invoice_paid",
    toEmail: "a@b.com",
    platformDisabled: ["invoice_paid"],
    userDisabledEmails: [],
    resendConfigured: true,
  }),
  { send: false, reason: "platform" },
);
assert.deepEqual(
  emailShouldSend({
    template: "invoice_paid",
    toEmail: "a@b.com",
    platformDisabled: [],
    userDisabledEmails: ["invoice_paid"],
    resendConfigured: true,
  }),
  { send: false, reason: "user" },
);
assert.deepEqual(
  emailShouldSend({
    template: "password_changed",
    toEmail: "a@b.com",
    platformDisabled: [],
    userDisabledEmails: ["password_changed"],
    resendConfigured: true,
  }),
  { send: true },
);
assert.deepEqual(
  emailShouldSend({
    template: "operator_gas_low",
    toEmail: "ops@b.com",
    platformDisabled: [],
    userDisabledEmails: ["operator_gas_low"],
    resendConfigured: true,
  }),
  { send: true },
);
assert.deepEqual(
  emailShouldSend({
    template: "payment_failed",
    toEmail: "a@b.com",
    platformDisabled: [],
    userDisabledEmails: [],
    resendConfigured: false,
  }),
  { send: false, reason: "resend" },
);
assert.deepEqual(
  emailShouldSend({
    template: "payment_failed",
    toEmail: "not-an-email",
    platformDisabled: [],
    userDisabledEmails: [],
    resendConfigured: true,
  }),
  { send: false, reason: "no_recipient" },
);

assert.equal(
  inboxShouldInsert({
    template: "invoice_issued",
    userDisabledInApp: [],
  }),
  true,
);
assert.equal(
  inboxShouldInsert({
    template: "invoice_issued",
    userDisabledInApp: ["invoice_issued"],
  }),
  false,
);
assert.equal(
  inboxShouldInsert({
    template: "operator_payout_requested",
    userDisabledInApp: [],
  }),
  false,
);

assert.equal(parseEmailDispatchClaim("new"), "new");
assert.equal(parseEmailDispatchClaim(true), "new");
assert.equal(parseEmailDispatchClaim("retry"), "retry");
assert.equal(parseEmailDispatchClaim("done"), null);
assert.equal(parseEmailDispatchClaim(false), null);
assert.equal(emailDispatchShouldComplete("sent"), true);
assert.equal(emailDispatchShouldComplete("skipped"), true);
assert.equal(emailDispatchShouldComplete("unconfigured"), false);
assert.equal(emailDispatchShouldComplete("failed"), false);

assert.equal(resendConfigured({}), false);
assert.equal(resendConfigured({ RESEND_API_KEY: "rk", EMAIL_FROM: "" }), false);
assert.equal(
  resendConfigured({ RESEND_API_KEY: "rk", EMAIL_FROM: "TBP <a@b.com>" }),
  true,
);

assert.equal(invoiceIssuedKey("inv-1"), "invoice:inv-1");
assert.equal(invoicePaidKey("inv-1"), "invoice-paid:inv-1");
assert.equal(
  paymentFailedKey("pi_1", Date.parse("2026-09-16T01:00:00.000Z")),
  "payment-failed:pi_1:2026-09-16",
);
assert.equal(
  depositCreditedKey("arbitrum-sepolia", "0xabc", 3),
  "deposit:arbitrum-sepolia:0xabc:3",
);
assert.equal(accountShortfallKey("u1", "inv-2"), "shortfall:u1:inv-2");
assert.equal(copyInviteKey("share-1"), "copy-invite:share-1");
assert.equal(
  deskOrderFailedKey("desk-1", "futures_failed", Date.parse("2026-09-16T12:00:00.000Z")),
  "desk-order:desk-1:futures_failed:2026-09-16",
);
assert.equal(
  passwordChangedKey("u1", Date.parse("2026-09-16T08:15:30.000Z")),
  "password:u1:2026-09-16T08:15",
);
assert.equal(payoutMemberHref("main"), "/account/billing?tab=wallet");
assert.equal(payoutMemberHref("affiliate"), "/affiliates?tab=payouts");
assert.equal(payoutOperatorHref("main"), "/admin/billing?tab=withdrawals");

const issued = notificationCopy.invoice_issued({
  planName: "Plus",
  amount: "$19",
  dueAt: "1 Oct 2026",
});
assert.equal(issued.subject, "Invoice ready — Plus $19");
assert.equal(inboxTitle(issued), issued.subject);
assert.match(inboxBody(issued), /Plus renewal invoice for \$19/);
assert.equal(issued.actionUrl, "/account/billing?tab=invoices");

const password = notificationCopy.password_changed();
assert.equal(password.subject, "Your password was changed");
assert.equal(password.actionUrl, "/account/settings");

const operator = notificationCopy.operator_gas_low({
  chain: "Arbitrum Sepolia",
  balanceEth: "0.001",
  thresholdEth: "0.005",
});
assert.match(operator.subject, /Gas wallet low/);
assert.equal(operator.actionUrl, "/admin/billing");

for (const id of NOTIFICATION_IDS) {
  const sample = sampleNotice(id);
  assert.equal(sample.subject.length > 0, true);
  assert.equal(sample.paragraphs.length > 0, true);
  assert.equal(sample.actionLabel.length > 0, true);
}
for (const id of operatorNotificationIds()) {
  const sample = sampleOperatorNotice(id);
  assert.equal(sample.subject, sampleNotice(id).subject);
}

console.log("notification catalog checks passed");
