import assert from "node:assert/strict";
import {
  INVOICE_COLLECT_LEAD_MS,
  INVOICE_DUE_BUFFER_MS,
  INVOICE_LEAD_MS,
  invoiceStatusLabel,
  matchOpenRenewalInvoice,
  openInvoiceIsCollectible,
  renewalAlreadyCovered,
  renewalCycleFromPeriodEnd,
  renewalExternalId,
  shouldIssueRenewalInvoice,
} from "./billing-cycle";

const periodEnd = Date.parse("2026-10-15T00:00:00.000Z");
const cycle = renewalCycleFromPeriodEnd(periodEnd);
assert.equal(cycle.periodStartMs, periodEnd);
assert.equal(cycle.dueAtMs, periodEnd + INVOICE_DUE_BUFFER_MS);
assert.equal(cycle.collectAfterMs, periodEnd - INVOICE_COLLECT_LEAD_MS);
assert.equal(cycle.issueAfterMs, periodEnd - INVOICE_LEAD_MS);

assert.equal(
  shouldIssueRenewalInvoice({
    nowMs: periodEnd - INVOICE_LEAD_MS,
    periodEndMs: periodEnd,
    planPriceUsd: 19,
    alreadyIssued: false,
  }),
  true,
);
assert.equal(
  shouldIssueRenewalInvoice({
    nowMs: periodEnd - INVOICE_LEAD_MS - 1,
    periodEndMs: periodEnd,
    planPriceUsd: 19,
    alreadyIssued: false,
  }),
  false,
);
assert.equal(
  shouldIssueRenewalInvoice({
    nowMs: periodEnd,
    periodEndMs: periodEnd,
    planPriceUsd: 19,
    alreadyIssued: true,
  }),
  false,
);
assert.equal(
  shouldIssueRenewalInvoice({
    nowMs: periodEnd,
    periodEndMs: periodEnd,
    planPriceUsd: 0,
    alreadyIssued: false,
  }),
  false,
);

assert.equal(
  renewalExternalId("user-1", "2026-10-15T00:00:00.000Z"),
  "renewal:user-1:2026-10-15T00:00:00.000Z",
);
assert.equal(
  matchOpenRenewalInvoice(
    [
      {
        id: "inv-1",
        amountUsd: 19,
        periodStart: "2026-10-15T00:00:00.000Z",
      },
    ],
    { amountUsd: 19, periodStartMs: periodEnd },
  ),
  "inv-1",
);
assert.equal(
  renewalAlreadyCovered(
    [
      {
        externalId: "in_stripe_1",
        periodStart: "2026-10-15T00:00:00.000Z",
        status: "paid",
      },
    ],
    { externalId: "renewal:user-1:2026-10-15T00:00:00.000Z", periodStartMs: periodEnd },
  ),
  true,
);
assert.equal(
  renewalAlreadyCovered(
    [
      {
        externalId: "wallet:user-1:other",
        periodStart: "2026-09-01T00:00:00.000Z",
        status: "paid",
      },
    ],
    { externalId: "renewal:user-1:2026-10-15T00:00:00.000Z", periodStartMs: periodEnd },
  ),
  false,
);
assert.equal(
  openInvoiceIsCollectible(
    { dueAt: new Date(cycle.dueAtMs).toISOString(), periodStart: new Date(periodEnd).toISOString() },
    cycle.collectAfterMs - 1,
  ),
  false,
);
assert.equal(
  openInvoiceIsCollectible(
    { dueAt: new Date(cycle.dueAtMs).toISOString(), periodStart: new Date(periodEnd).toISOString() },
    cycle.collectAfterMs,
  ),
  true,
);
assert.equal(invoiceStatusLabel("open"), "Unpaid");
assert.equal(invoiceStatusLabel("paid"), "Paid");

console.log("membership billing cycle checks passed");
