"use client";

import { useCallback, useMemo } from "react";
import {
  IconCheck,
  IconDownload,
  IconFilterClear,
  IconOpen,
  IconReject,
} from "@/components/icons";
import {
  LiveGetForm,
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableActions,
  TableCard,
  TableFilterField,
  TableFilterSession,
  TableIconAction,
  TableLabelButton,
  TablePendingIconAction,
  TablePendingLabelButton,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import {
  markPayoutFilePaidAction,
  rejectPayoutAction,
} from "@/lib/membership/affiliate-actions";
import type { PayoutFileRow, PayoutRow } from "@/lib/membership/affiliate-store";
import {
  adminPayoutsPath,
  monthJoinedLabel,
  PAYOUT_FILE_STATUSES,
  PAYOUT_STATUSES,
  payoutEligibleForAirdropFile,
  payoutStatusLabel,
  shortenPayoutAddress,
} from "@/lib/membership/affiliate";
import { formatUsd } from "@/lib/membership/billing";
import type { WalletBook } from "@/lib/membership/wallet";
import { compareTableNum, compareTableText, type TableSortDir } from "@/lib/table-chrome";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";
import { AppSelect } from "@/components/app-select";

function keepEntries(keep: Record<string, string | undefined>) {
  return Object.entries(keep).filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function comparePayoutFiles(
  left: PayoutFileRow,
  right: PayoutFileRow,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "network") {
    return compareTableText(left.network, right.network, dir);
  }
  if (key === "payouts") {
    return compareTableNum(left.payoutCount, right.payoutCount, dir);
  }
  if (key === "amount") {
    return compareTableNum(left.amountUsd, right.amountUsd, dir);
  }
  if (key === "status") {
    return compareTableText(left.status, right.status, dir);
  }
  return compareTableText(left.createdAt, right.createdAt, dir);
}

function comparePayouts(
  left: PayoutRow,
  right: PayoutRow,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "member") {
    return compareTableText(left.email ?? left.userId, right.email ?? right.userId, dir);
  }
  if (key === "amount") {
    return compareTableNum(left.amountUsd, right.amountUsd, dir);
  }
  if (key === "network") {
    return compareTableText(left.network ?? "", right.network ?? "", dir);
  }
  if (key === "address") {
    return compareTableText(left.address ?? "", right.address ?? "", dir);
  }
  if (key === "status") {
    return compareTableText(left.status, right.status, dir);
  }
  if (key === "paid") {
    return compareTableText(left.paidAt ?? "", right.paidAt ?? "", dir);
  }
  return compareTableText(left.createdAt, right.createdAt, dir);
}

function matchesPayoutFileNeedle(file: PayoutFileRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const hay = [
    file.network,
    file.status,
    file.status === "paid" ? "paid" : "pending",
    file.id,
    file.externalId ?? "",
    String(file.payoutCount),
    formatUsd(file.amountUsd),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function AdminPayoutFilesTable({
  files,
  book,
  fileStatus,
  fileQ = "",
  keep,
}: {
  files: PayoutFileRow[];
  book: WalletBook;
  fileStatus: string;
  fileQ?: string;
  keep?: Record<string, string | undefined>;
}) {
  const compare = useCallback(comparePayoutFiles, []);
  const filtered = useMemo(
    () => files.filter((file) => matchesPayoutFileNeedle(file, fileQ)),
    [fileQ, files],
  );
  const table = useClientTable(filtered, compare, {
    defaultKey: "when",
    defaultDir: "desc",
  });
  const clearHref = adminPayoutsPath(book, keep);

  return (
    <>
      <TableFilterSession defaultOpen={Boolean(fileQ.trim() || fileStatus)}>
          <LiveGetForm>
            <input type="hidden" name="page" value="1" />
            {keepEntries(keep ?? {}).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <TableFilterField label="Search">
              <input
                name="fileQ"
                type="search"
                defaultValue={fileQ}
                placeholder="Network, id, or hash"
                autoComplete="off"
                className={TABLE_FILTER_FIELD_CLASS}
              />
            </TableFilterField>
            <TableFilterField label="Status">
              <AppSelect
                name="fileStatus"
                defaultValue={fileStatus}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="">All</option>
                {PAYOUT_FILE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === "paid" ? "Paid" : "Pending"}
                  </option>
                ))}
              </AppSelect>
            </TableFilterField>
            <TableLabelButton
              href={clearHref}
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
            emptyLabel="No files match."
          />
        }
      >
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.12em] text-ink-faint">
            <tr>
              <SortTh
                label="When"
                active={table.sortKey === "when"}
                dir={table.sortDir}
                onSort={() => table.onSort("when")}
              />
              <SortTh
                label="Network"
                active={table.sortKey === "network"}
                dir={table.sortDir}
                onSort={() => table.onSort("network")}
              />
              <SortTh
                label="Payouts"
                active={table.sortKey === "payouts"}
                dir={table.sortDir}
                onSort={() => table.onSort("payouts")}
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
              <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-ink-muted">
                  No files match.
                </td>
              </tr>
            ) : (
              table.pageRows.map((file) => (
                <tr key={file.id} className="border-t border-line">
                  <td className="py-3 pr-3 text-ink-muted">
                    {monthJoinedLabel(file.createdAt)}
                  </td>
                  <td className="py-3 pr-3">{file.network}</td>
                  <td className="py-3 pr-3 tabular-nums">{file.payoutCount}</td>
                  <td className="py-3 pr-3 tabular-nums">
                    {formatUsd(file.amountUsd)}
                  </td>
                  <td className="py-3 pr-3">
                    <StatusBadge
                      label={file.status === "paid" ? "Paid" : "Pending"}
                      status={file.status}
                    />
                  </td>
                  <td className={TABLE_ACTIONS_TD_CLASS}>
                    <TableActions>
                      <TableIconAction
                        href={`/admin/affiliates/files/${file.id}`}
                        target="_blank"
                        rel="noreferrer"
                        label="View details"
                        detail="Open this file's payouts."
                      >
                        <IconOpen {...TABLE_BTN_ICON} />
                      </TableIconAction>
                      <TableIconAction
                        href={`/admin/affiliates/files/${file.id}/export`}
                        label="Download CSV"
                        detail="Download this file as CSV."
                      >
                        <IconDownload {...TABLE_BTN_ICON} />
                      </TableIconAction>
                      {file.status === "pending" ? (
                        <form
                          action={markPayoutFilePaidAction}
                          className="inline-flex flex-nowrap items-center gap-2"
                        >
                          <input type="hidden" name="fileId" value={file.id} />
                          <input type="hidden" name="book" value={book} />
                          <input
                            name="externalId"
                            placeholder="Airdrop tx hash"
                            className="w-36 rounded-control border border-line bg-canvas px-2 py-1 text-xs text-ink"
                          />
                          <TablePendingLabelButton
                            pendingLabel="…"
                            variant="primary"
                            icon={<IconCheck {...TABLE_BTN_ICON} />}
                          >
                            Mark file paid
                          </TablePendingLabelButton>
                        </form>
                      ) : (
                        <span className="text-hint text-ink-faint">
                          {file.externalId ?? "Paid"}
                        </span>
                      )}
                    </TableActions>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}

export function AdminPayoutQueueTable({
  payouts,
  book,
  payoutStatus,
  keep,
}: {
  payouts: PayoutRow[];
  book: WalletBook;
  payoutStatus: string;
  keep?: Record<string, string | undefined>;
}) {
  const compare = useCallback(comparePayouts, []);
  const table = useClientTable(payouts, compare, {
    defaultKey: "when",
    defaultDir: "desc",
  });
  const clearHref = adminPayoutsPath(book, keep);

  return (
    <>
      <TableFilterSession defaultOpen={Boolean(payoutStatus)}>
          <LiveGetForm>
            <input type="hidden" name="page" value="1" />
            {keepEntries(keep ?? {}).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <TableFilterField label="Status">
              <AppSelect
                name="payoutStatus"
                defaultValue={payoutStatus}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="">All</option>
                {PAYOUT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {payoutStatusLabel(status)}
                  </option>
                ))}
              </AppSelect>
            </TableFilterField>
            <TableLabelButton
              href={clearHref}
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
            emptyLabel="No requests match."
          />
        }
      >
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.12em] text-ink-faint">
            <tr>
              <SortTh
                label="When"
                active={table.sortKey === "when"}
                dir={table.sortDir}
                onSort={() => table.onSort("when")}
              />
              <SortTh
                label="Member"
                active={table.sortKey === "member"}
                dir={table.sortDir}
                onSort={() => table.onSort("member")}
              />
              <SortTh
                label="Amount"
                active={table.sortKey === "amount"}
                dir={table.sortDir}
                onSort={() => table.onSort("amount")}
              />
              <SortTh
                label="Network"
                active={table.sortKey === "network"}
                dir={table.sortDir}
                onSort={() => table.onSort("network")}
              />
              <SortTh
                label="Address"
                active={table.sortKey === "address"}
                dir={table.sortDir}
                onSort={() => table.onSort("address")}
              />
              <SortTh
                label="Status"
                active={table.sortKey === "status"}
                dir={table.sortDir}
                onSort={() => table.onSort("status")}
              />
              <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-ink-muted">
                  No requests match.
                </td>
              </tr>
            ) : (
              table.pageRows.map((payout) => (
                <tr key={payout.id} className="border-t border-line">
                  <td className="py-3 pr-3 text-ink-muted">
                    {monthJoinedLabel(payout.createdAt)}
                  </td>
                  <td className="py-3 pr-3">{payout.email ?? payout.userId}</td>
                  <td className="py-3 pr-3 tabular-nums">
                    {formatUsd(payout.amountUsd)}
                  </td>
                  <td className="py-3 pr-3">{payout.network ?? "—"}</td>
                  <td
                    className="py-3 pr-3 font-mono text-xs"
                    title={payout.address ?? undefined}
                  >
                    {shortenPayoutAddress(payout.address)}
                  </td>
                  <td className="py-3 pr-3">
                    <StatusBadge
                      label={payoutStatusLabel(payout.status)}
                      status={payout.status}
                    />
                    {payout.payoutFileId ? (
                      <span className="mt-1 block text-hint text-ink-muted">
                        File {payout.payoutFileId.slice(0, 8)}
                      </span>
                    ) : null}
                  </td>
                  <td className={TABLE_ACTIONS_TD_CLASS}>
                    {payoutEligibleForAirdropFile(payout.status) ? (
                      <form action={rejectPayoutAction}>
                        <input type="hidden" name="payoutId" value={payout.id} />
                        <input type="hidden" name="book" value={book} />
                        <TablePendingIconAction
                          danger
                          pendingLabel="…"
                          label="Reject"
                          detail="Reject this payout request."
                        >
                          <IconReject {...TABLE_BTN_ICON} />
                        </TablePendingIconAction>
                      </form>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}

export function AdminPayoutFilePaymentsTable({
  payouts,
  status,
  fileId,
}: {
  payouts: PayoutRow[];
  status: string;
  fileId: string;
}) {
  const compare = useCallback(comparePayouts, []);
  const table = useClientTable(payouts, compare, {
    defaultKey: "when",
    defaultDir: "desc",
  });
  const clearHref = `/admin/affiliates/files/${fileId}`;

  return (
    <>
      <TableFilterSession defaultOpen={Boolean(status)}>
          <LiveGetForm>
            <input type="hidden" name="page" value="1" />
            <TableFilterField label="Status">
              <AppSelect
                name="status"
                defaultValue={status}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="">All</option>
                {PAYOUT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {payoutStatusLabel(value)}
                  </option>
                ))}
              </AppSelect>
            </TableFilterField>
            <TableLabelButton
              href={clearHref}
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
            emptyLabel="No payments match."
          />
        }
      >
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.12em] text-ink-faint">
            <tr>
              <SortTh
                label="When"
                active={table.sortKey === "when"}
                dir={table.sortDir}
                onSort={() => table.onSort("when")}
              />
              <SortTh
                label="Member"
                active={table.sortKey === "member"}
                dir={table.sortDir}
                onSort={() => table.onSort("member")}
              />
              <SortTh
                label="Amount"
                active={table.sortKey === "amount"}
                dir={table.sortDir}
                onSort={() => table.onSort("amount")}
              />
              <SortTh
                label="Network"
                active={table.sortKey === "network"}
                dir={table.sortDir}
                onSort={() => table.onSort("network")}
              />
              <SortTh
                label="Address"
                active={table.sortKey === "address"}
                dir={table.sortDir}
                onSort={() => table.onSort("address")}
              />
              <SortTh
                label="Status"
                active={table.sortKey === "status"}
                dir={table.sortDir}
                onSort={() => table.onSort("status")}
              />
              <SortTh
                label="Paid"
                active={table.sortKey === "paid"}
                dir={table.sortDir}
                onSort={() => table.onSort("paid")}
              />
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-ink-muted">
                  No payments match.
                </td>
              </tr>
            ) : (
              table.pageRows.map((payout) => {
                const requested = parseDisplayTime(payout.createdAt);
                const settled = parseDisplayTime(payout.paidAt);
                return (
                  <tr key={payout.id} className="border-t border-line">
                    <td className="py-3 pr-3 whitespace-nowrap text-ink-muted">
                      {requested ? formatLocalDate(requested) : "—"}
                    </td>
                    <td className="py-3 pr-3">{payout.email ?? payout.userId}</td>
                    <td className="py-3 pr-3 tabular-nums">
                      {formatUsd(payout.amountUsd)}
                    </td>
                    <td className="py-3 pr-3">{payout.network ?? "—"}</td>
                    <td
                      className="py-3 pr-3 font-mono text-xs whitespace-nowrap"
                      title={payout.address ?? undefined}
                    >
                      {shortenPayoutAddress(payout.address)}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <StatusBadge
                        label={payoutStatusLabel(payout.status)}
                        status={payout.status}
                      />
                    </td>
                    <td className="py-3 whitespace-nowrap text-ink-muted">
                      {settled ? formatLocalDate(settled) : "—"}
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
