"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ColumnHint } from "@/components/column-hint";
import { IconOpen } from "@/components/icons";
import {
  SortTh,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TableCard,
  TablePager,
  TablePendingIconAction,
  useClientTable,
} from "@/components/table-chrome";
import { TokenIcon } from "@/components/token-icon";
import { formatPct, signedTone } from "@/lib/opportunities/format";
import { openPaperCarry } from "@/lib/paper/actions";
import { OpportunityBookAndSize } from "@/components/usdt-size-input";
import { type OpportunityPaperProps } from "@/lib/paper/open";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";

function compareNullableNum(
  left: number | null,
  right: number | null,
  dir: TableSortDir,
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return compareTableNum(left, right, dir);
}

function compareOpportunity(
  left: ScannedOpportunity,
  right: ScannedOpportunity,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "pair") {
    return compareTableText(
      `${left.baseCoin} ${left.futureSymbol}`,
      `${right.baseCoin} ${right.futureSymbol}`,
      dir,
    );
  }
  if (key === "dte") {
    return compareTableNum(left.daysToExpiry, right.daysToExpiry, dir);
  }
  if (key === "basis") {
    return compareTableNum(left.executableBasis, right.executableBasis, dir);
  }
  if (key === "fees") {
    return compareTableNum(left.feeRate, right.feeRate, dir);
  }
  if (key === "netBasis") {
    return compareTableNum(left.netBasis, right.netBasis, dir);
  }
  if (key === "netApr") {
    return compareNullableNum(left.netApr, right.netApr, dir);
  }
  if (key === "book") {
    return compareTableNum(left.capacityUsdt, right.capacityUsdt, dir);
  }
  return 0;
}

export function OpportunityRows({
  rows,
  paper,
}: {
  rows: ScannedOpportunity[];
  paper?: OpportunityPaperProps;
}) {
  return (
    <tbody>
      {rows.map((row) => (
        <tr
          key={`${row.spotSymbol}-${row.futureSymbol}`}
          className="border-b border-line last:border-b-0"
        >
          <td className="px-4 py-3">
            <span className="flex items-center gap-2 font-medium">
              <TokenIcon symbol={row.baseCoin} />
              {row.baseCoin}
            </span>
            <span className="mt-0.5 block pl-7 text-xs text-ink-faint">
              {row.futureSymbol}
            </span>
          </td>
          <td className="px-4 py-3 tabular-nums text-ink-muted">
            {row.daysToExpiry > 0 ? row.daysToExpiry.toFixed(1) : "—"}
          </td>
          <td
            className={`px-4 py-3 tabular-nums ${signedTone(row.executableBasis)}`}
          >
            {formatPct(row.executableBasis)}
          </td>
          <td className="px-4 py-3 tabular-nums text-ink-muted">
            {formatPct(row.feeRate)}
          </td>
          <td className={`px-4 py-3 tabular-nums ${signedTone(row.netBasis)}`}>
            {formatPct(row.netBasis)}
          </td>
          <td className={`px-4 py-3 tabular-nums ${signedTone(row.netApr)}`}>
            {formatPct(row.netApr)}
          </td>
          <OpportunityBookAndSize
            row={row}
            paper={paper}
            formId={openFormId(row)}
          />
          {paper ? (
            <td className={TABLE_ACTIONS_TD_CLASS}>
              <PaperOpenAction row={row} paper={paper} />
            </td>
          ) : null}
        </tr>
      ))}
    </tbody>
  );
}

export function OpportunityTable({
  rows,
  paper,
}: {
  rows: ScannedOpportunity[];
  paper?: OpportunityPaperProps;
}) {
  const compare = useCallback(
    (
      left: ScannedOpportunity,
      right: ScannedOpportunity,
      key: string,
      dir: TableSortDir,
    ) => compareOpportunity(left, right, key, dir),
    [],
  );
  const table = useClientTable(rows, compare);

  return (
    <TableCard
      pager={
        <TablePager
          window={table.window}
          onPrev={() => table.setPage(table.window.page - 1)}
          onNext={() => table.setPage(table.window.page + 1)}
        />
      }
    >
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <SortTh
                label="Pair"
                active={table.sortKey === "pair"}
                dir={table.sortDir}
                onSort={() => table.onSort("pair")}
              />
              <SortTh
                label="DTE"
                active={table.sortKey === "dte"}
                dir={table.sortDir}
                onSort={() => table.onSort("dte")}
              />
              <SortTh
                label="Basis"
                active={table.sortKey === "basis"}
                dir={table.sortDir}
                onSort={() => table.onSort("basis")}
              />
              <SortTh
                label="Fees + slip"
                active={table.sortKey === "fees"}
                dir={table.sortDir}
                onSort={() => table.onSort("fees")}
              />
              <SortTh
                label="Net basis"
                active={table.sortKey === "netBasis"}
                dir={table.sortDir}
                onSort={() => table.onSort("netBasis")}
              />
              <SortTh
                label="Net APR"
                active={table.sortKey === "netApr"}
                dir={table.sortDir}
                onSort={() => table.onSort("netApr")}
              />
              <SortTh
                label="Usable book"
                active={table.sortKey === "book"}
                dir={table.sortDir}
                onSort={() => table.onSort("book")}
              />
              {paper ? (
                <>
                  <th className="px-4 py-3 font-medium">
                    <ColumnHint
                      label="Size USDT"
                      hint={
                        paper.venueOpen
                          ? "USDT value on the bound exchange. Cannot exceed usable book. A second Open on the same pair adds to the existing position."
                          : "Paper value to open. Cannot exceed usable book. Each Open creates a new paper row."
                      }
                    />
                  </th>
                  <th className={TABLE_ACTIONS_TH_CLASS}>
                    <ColumnHint
                      label="Actions"
                      hint={
                        paper.venueOpen
                          ? "Open cash-and-carry on the bound exchange (buy spot, short the dated future). Same pair adds size."
                          : "Open a paper carry at the live scan net basis. No Bybit order."
                      }
                    />
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <OpportunityRows rows={table.pageRows} paper={paper} />
        </table>
    </TableCard>
  );
}

function openFormId(row: ScannedOpportunity) {
  return `open-${row.spotSymbol}-${row.futureSymbol}`;
}

function PaperOpenAction({
  row,
  paper,
}: {
  row: ScannedOpportunity;
  paper: OpportunityPaperProps;
}) {
  if (!paper.signedIn) {
    return (
      <Link href="/sign-in" className="text-accent hover:text-accent-strong">
        Sign in
      </Link>
    );
  }
  if (!paper.canOpen) {
    return <span className="text-xs text-ink-faint">Live</span>;
  }

  return (
    <form id={openFormId(row)} action={openPaperCarry}>
      <input type="hidden" name="spotSymbol" value={row.spotSymbol} />
      <input type="hidden" name="futureSymbol" value={row.futureSymbol} />
      <input type="hidden" name="shownCapacityUsdt" value={String(row.capacityUsdt)} />
      <input type="hidden" name="next" value={paper.next} />
      <TablePendingIconAction
        pendingLabel="Opening"
        successKey={`open-${row.spotSymbol}-${row.futureSymbol}`}
        label="Open"
        detail="Open this pair on the paper desk."
      >
        <IconOpen {...TABLE_BTN_ICON} />
      </TablePendingIconAction>
    </form>
  );
}
