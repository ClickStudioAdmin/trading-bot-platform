"use client";

import { useCallback, useMemo } from "react";
import { IconFilterClear } from "@/components/icons";
import {
  LiveGetForm,
  SortTh,
  StatusBadge,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableCard,
  TableFilterField,
  TableFilterSession,
  TableLabelButton,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import {
  formatUsd,
  invoiceMethodLabel,
  INVOICE_STATUSES,
} from "@/lib/membership/billing";
import { invoiceStatusLabel } from "@/lib/membership/billing-cycle";
import type { AdminInvoice } from "@/lib/membership/billing-store";
import { compareTableNum, compareTableText, type TableSortDir } from "@/lib/table-chrome";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";
import { AppSelect } from "@/components/app-select";

function periodLabel(invoice: AdminInvoice): string {
  const periodStart = parseDisplayTime(invoice.periodStart);
  const periodEnd = parseDisplayTime(invoice.periodEnd);
  return periodStart && periodEnd
    ? `${formatLocalDate(periodStart)} – ${formatLocalDate(periodEnd)}`
    : "";
}

function compareInvoices(
  left: AdminInvoice,
  right: AdminInvoice,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "member") {
    return compareTableText(left.email ?? left.userId, right.email ?? right.userId, dir);
  }
  if (key === "plan") {
    return compareTableText(left.planName, right.planName, dir);
  }
  if (key === "method") {
    return compareTableText(
      invoiceMethodLabel(left.method),
      invoiceMethodLabel(right.method),
      dir,
    );
  }
  if (key === "amount") {
    return compareTableNum(left.amountUsd, right.amountUsd, dir);
  }
  if (key === "status") {
    return compareTableText(left.status, right.status, dir);
  }
  if (key === "due") {
    return compareTableText(left.dueAt ?? "", right.dueAt ?? "", dir);
  }
  if (key === "period") {
    return compareTableText(periodLabel(left), periodLabel(right), dir);
  }
  if (key === "external") {
    return compareTableText(left.externalId ?? "", right.externalId ?? "", dir);
  }
  return compareTableText(left.createdAt, right.createdAt, dir);
}

function matchesInvoiceNeedle(invoice: AdminInvoice, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const hay = [
    invoice.email ?? "",
    invoice.userId,
    invoice.planName,
    invoiceMethodLabel(invoice.method),
    invoiceStatusLabel(invoice.status),
    invoice.status,
    invoice.externalId ?? "",
    formatUsd(invoice.amountUsd),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function AdminInvoicesTable({
  invoices,
  status,
  q = "",
}: {
  invoices: AdminInvoice[];
  status: string;
  q?: string;
}) {
  const compare = useCallback(compareInvoices, []);
  const filtered = useMemo(
    () => invoices.filter((invoice) => matchesInvoiceNeedle(invoice, q)),
    [invoices, q],
  );
  const table = useClientTable(filtered, compare, {
    defaultKey: "date",
    defaultDir: "desc",
  });

  return (
    <>
      <TableFilterSession defaultOpen={Boolean(q?.trim() || status)}>
          <LiveGetForm>
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="tab" value="invoices" />
            <TableFilterField label="Search">
              <input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Member, plan, or id"
                autoComplete="off"
                className={TABLE_FILTER_FIELD_CLASS}
              />
            </TableFilterField>
            <TableFilterField label="Status">
              <AppSelect
                name="status"
                defaultValue={status}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="">All</option>
                {INVOICE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {invoiceStatusLabel(value)}
                  </option>
                ))}
              </AppSelect>
            </TableFilterField>
            <TableLabelButton
              href="/admin/billing?tab=invoices"
              variant="filter"
              icon={<IconFilterClear {...TABLE_BTN_ICON} />}
            >
              Clear
            </TableLabelButton>
          </LiveGetForm>
      </TableFilterSession>
      <TableCard
        pager={
          <TablePager
            window={table.window}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
            emptyLabel="No invoices."
          />
        }
      >
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink-faint">
            <tr>
              <SortTh
                label="Date"
                active={table.sortKey === "date"}
                dir={table.sortDir}
                onSort={() => table.onSort("date")}
              />
              <SortTh
                label="Member"
                active={table.sortKey === "member"}
                dir={table.sortDir}
                onSort={() => table.onSort("member")}
              />
              <SortTh
                label="Plan"
                active={table.sortKey === "plan"}
                dir={table.sortDir}
                onSort={() => table.onSort("plan")}
              />
              <SortTh
                label="Method"
                active={table.sortKey === "method"}
                dir={table.sortDir}
                onSort={() => table.onSort("method")}
              />
              <SortTh
                label="Amount"
                active={table.sortKey === "amount"}
                dir={table.sortDir}
                onSort={() => table.onSort("amount")}
              />
              <SortTh
                label="Status"
                active={table.sortKey === "status"}
                dir={table.sortDir}
                onSort={() => table.onSort("status")}
              />
              <SortTh
                label="Due"
                active={table.sortKey === "due"}
                dir={table.sortDir}
                onSort={() => table.onSort("due")}
              />
              <SortTh
                label="Period"
                active={table.sortKey === "period"}
                dir={table.sortDir}
                onSort={() => table.onSort("period")}
              />
              <SortTh
                label="External id"
                active={table.sortKey === "external"}
                dir={table.sortDir}
                onSort={() => table.onSort("external")}
              />
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-sm text-ink-muted">
                  No invoices match.
                </td>
              </tr>
            ) : (
              table.pageRows.map((invoice) => {
                const created = parseDisplayTime(invoice.createdAt);
                const due = parseDisplayTime(invoice.dueAt);
                const period = periodLabel(invoice);
                return (
                  <tr key={invoice.id} className="border-t border-line">
                    <td className="py-3 pr-3 whitespace-nowrap text-ink-muted">
                      {created ? formatLocalDate(created) : "—"}
                    </td>
                    <td className="py-3 pr-3">{invoice.email ?? invoice.userId}</td>
                    <td className="py-3 pr-3">{invoice.planName}</td>
                    <td className="py-3 pr-3">
                      {invoiceMethodLabel(invoice.method)}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {formatUsd(invoice.amountUsd)}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge
                        label={invoiceStatusLabel(invoice.status)}
                        status={invoiceStatusLabel(invoice.status)}
                      />
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-ink-muted">
                      {due ? formatLocalDate(due) : "—"}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-ink-muted">
                      {period || "—"}
                    </td>
                    <td
                      className="py-3 max-w-[12rem] truncate font-mono text-xs text-ink-muted"
                      title={invoice.externalId ?? undefined}
                    >
                      {invoice.externalId ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
