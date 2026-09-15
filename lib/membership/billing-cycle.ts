import { WALLET_PERIOD_MS, roundUsd } from "./wallet";

export const INVOICE_LEAD_MS = 7 * 24 * 60 * 60 * 1000;
export const INVOICE_COLLECT_LEAD_MS = 6 * 60 * 60 * 1000;
export const INVOICE_DUE_BUFFER_MS = 6 * 60 * 60 * 1000;

export function renewalCycleFromPeriodEnd(periodEndMs: number): {
  periodStartMs: number;
  periodEndMs: number;
  dueAtMs: number;
  collectAfterMs: number;
  issueAfterMs: number;
} {
  const periodStartMs = periodEndMs;
  return {
    periodStartMs,
    periodEndMs: periodStartMs + WALLET_PERIOD_MS,
    dueAtMs: periodEndMs + INVOICE_DUE_BUFFER_MS,
    collectAfterMs: periodEndMs - INVOICE_COLLECT_LEAD_MS,
    issueAfterMs: periodEndMs - INVOICE_LEAD_MS,
  };
}

export function renewalExternalId(userId: string, periodStartIso: string): string {
  return `renewal:${userId}:${periodStartIso}`;
}

export function shouldIssueRenewalInvoice(input: {
  nowMs: number;
  periodEndMs: number;
  planPriceUsd: number;
  alreadyIssued: boolean;
}): boolean {
  if (input.alreadyIssued) {
    return false;
  }
  if (roundUsd(input.planPriceUsd) < 0.01) {
    return false;
  }
  if (!Number.isFinite(input.periodEndMs)) {
    return false;
  }
  return input.nowMs >= input.periodEndMs - INVOICE_LEAD_MS;
}

export function renewalAlreadyCovered(
  invoices: readonly {
    externalId?: string | null;
    periodStart: string | null;
    status: string;
  }[],
  input: { externalId: string; periodStartMs: number },
): boolean {
  return invoices.some((row) => {
    if (row.status === "void" || row.status === "refunded") {
      return false;
    }
    if (row.externalId === input.externalId) {
      return true;
    }
    if (!row.periodStart) {
      return false;
    }
    const start = Date.parse(row.periodStart);
    return (
      Number.isFinite(start) &&
      Math.abs(start - input.periodStartMs) <= 48 * 60 * 60 * 1000
    );
  });
}

export function openInvoiceIsCollectible(
  invoice: { dueAt: string | null; periodStart: string | null },
  nowMs = Date.now(),
): boolean {
  const startMs = Date.parse(invoice.periodStart ?? "");
  if (Number.isFinite(startMs)) {
    return nowMs >= startMs - INVOICE_COLLECT_LEAD_MS;
  }
  const dueMs = Date.parse(invoice.dueAt ?? "");
  return (
    Number.isFinite(dueMs) &&
    nowMs >= dueMs - INVOICE_DUE_BUFFER_MS - INVOICE_COLLECT_LEAD_MS
  );
}

export function matchOpenRenewalInvoice(
  open: readonly {
    id: string;
    amountUsd: number;
    periodStart: string | null;
  }[],
  paid: { amountUsd: number; periodStartMs: number | null },
): string | null {
  if (open.length === 0) {
    return null;
  }
  const paidStart = paid.periodStartMs;
  if (paidStart !== null) {
    const byPeriod = open.find((row) => {
      if (!row.periodStart) {
        return false;
      }
      const start = Date.parse(row.periodStart);
      return Number.isFinite(start) && Math.abs(start - paidStart) <= 48 * 60 * 60 * 1000;
    });
    if (byPeriod) {
      return byPeriod.id;
    }
  }
  const amount = roundUsd(paid.amountUsd);
  const byAmount = open.filter((row) => roundUsd(row.amountUsd) === amount);
  if (byAmount.length === 1) {
    return byAmount[0].id;
  }
  if (open.length === 1) {
    return open[0].id;
  }
  return null;
}

export function invoiceStatusLabel(status: string): string {
  if (status === "open") {
    return "Unpaid";
  }
  if (status === "paid") {
    return "Paid";
  }
  if (status === "refunded") {
    return "Refunded";
  }
  if (status === "void") {
    return "Void";
  }
  return status;
}
