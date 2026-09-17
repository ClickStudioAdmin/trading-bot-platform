"use client";

import { useMemo, useState } from "react";
import {
  SortTh,
  StatusBadge,
  TABLE_FILTER_CLEAR_CLASS,
  TABLE_FILTER_FIELD_CLASS,
  TableFilterBar,
  TableFilterField,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";
import { AppSelect } from "@/components/app-select";

const primaryBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const secondaryBtn =
  "rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink";
const bulkBtn =
  "rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40";
const dangerBulkBtn =
  "rounded-control border border-line px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-40";
const actionLink =
  "rounded-control border border-line px-2 py-0.5 text-xs font-medium text-accent hover:text-accent-strong";
const dangerLink =
  "rounded-control border border-line px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/10";

const TYPES = ["DCA", "Perps bots", "Cash and Carry"] as const;
const STATUSES = ["active", "disabled", "pending", "error"] as const;
const VENUES = ["Bybit", "Hyperliquid"] as const;

type SampleType = (typeof TYPES)[number];
type SampleStatus = (typeof STATUSES)[number];
type SortKey = "name" | "type" | "status" | "venue" | "updated";

type SampleRow = {
  id: string;
  name: string;
  type: SampleType;
  status: SampleStatus;
  venue: (typeof VENUES)[number];
  updated: string;
  updatedMs: number;
};

const SAMPLE_ROWS: SampleRow[] = [
  row("1", "BTC ladder", "DCA", "active", "Bybit", "17 Sep 2026", 17),
  row("2", "ETH grid", "DCA", "pending", "Bybit", "16 Sep 2026", 16),
  row("3", "SOL perps", "Perps bots", "active", "Hyperliquid", "16 Sep 2026", 16),
  row("4", "Carry main", "Cash and Carry", "disabled", "Bybit", "15 Sep 2026", 15),
  row("5", "DOGE scalp", "Perps bots", "error", "Bybit", "15 Sep 2026", 15),
  row("6", "BTC paper", "DCA", "active", "Bybit", "14 Sep 2026", 14),
  row("7", "ETH live", "DCA", "active", "Hyperliquid", "14 Sep 2026", 14),
  row("8", "Carry hedge", "Cash and Carry", "pending", "Bybit", "13 Sep 2026", 13),
  row("9", "ARB trend", "Perps bots", "disabled", "Hyperliquid", "13 Sep 2026", 13),
  row("10", "OP fade", "Perps bots", "active", "Bybit", "12 Sep 2026", 12),
  row("11", "BTC big", "DCA", "error", "Bybit", "12 Sep 2026", 12),
  row("12", "ETH big", "DCA", "active", "Hyperliquid", "11 Sep 2026", 11),
  row("13", "Carry alt", "Cash and Carry", "active", "Bybit", "11 Sep 2026", 11),
  row("14", "SOL paper", "Perps bots", "disabled", "Bybit", "10 Sep 2026", 10),
  row("15", "LINK grid", "DCA", "pending", "Bybit", "10 Sep 2026", 10),
  row("16", "AVAX scalp", "Perps bots", "active", "Hyperliquid", "9 Sep 2026", 9),
  row("17", "XRP carry", "Cash and Carry", "error", "Bybit", "9 Sep 2026", 9),
  row("18", "NEAR dca", "DCA", "active", "Bybit", "8 Sep 2026", 8),
  row("19", "SUI perps", "Perps bots", "pending", "Hyperliquid", "8 Sep 2026", 8),
  row("20", "TIA fade", "Perps bots", "disabled", "Bybit", "7 Sep 2026", 7),
  row("21", "WIF ladder", "DCA", "active", "Bybit", "7 Sep 2026", 7),
  row("22", "PEPE grid", "DCA", "error", "Hyperliquid", "6 Sep 2026", 6),
  row("23", "Carry BTC", "Cash and Carry", "active", "Bybit", "6 Sep 2026", 6),
  row("24", "HYPE trend", "Perps bots", "active", "Hyperliquid", "5 Sep 2026", 5),
];

function row(
  id: string,
  name: string,
  type: SampleType,
  status: SampleStatus,
  venue: SampleRow["venue"],
  updated: string,
  day: number,
): SampleRow {
  return {
    id,
    name,
    type,
    status,
    venue,
    updated,
    updatedMs: Date.UTC(2026, 8, day),
  };
}

function compareSampleRows(
  left: SampleRow,
  right: SampleRow,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "updated") {
    return compareTableNum(left.updatedMs, right.updatedMs, dir);
  }
  return compareTableText(
    String(left[key as SortKey]),
    String(right[key as SortKey]),
    dir,
  );
}

export function ThemeTableDraft() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SAMPLE_ROWS.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(needle) ||
        item.venue.toLowerCase().includes(needle)
      );
    });
  }, [query, typeFilter, statusFilter]);

  const table = useClientTable(filtered, compareSampleRows, {
    defaultKey: "name",
    defaultDir: "asc",
  });
  const pageRows = table.pageRows;
  const pageIds = pageRows.map((item) => item.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selectedCount = selected.size;

  function resetList() {
    table.setPage(1);
    setSelected(new Set());
  }

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    resetList();
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function flash(message: string) {
    setNotice(message);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Sample table</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Dummy rows only. Filters, sort, paging, and bulk actions work here
            so you can see the chrome. Live tables omit pieces they do not need.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtn}>
            Export all
          </button>
          <button type="button" className={primaryBtn}>
            New item
          </button>
        </div>
      </div>

      {showFilters ? (
        <TableFilterBar>
          <TableFilterField label="Search">
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetList();
              }}
              placeholder="Name or venue"
              autoComplete="off"
              className={TABLE_FILTER_FIELD_CLASS}
            />
          </TableFilterField>
          <TableFilterField label="Type">
            <AppSelect
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                resetList();
              }}
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="all">All</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </AppSelect>
          </TableFilterField>
          <TableFilterField label="Status">
            <AppSelect
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                resetList();
              }}
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="all">All</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </AppSelect>
          </TableFilterField>
          <button
            type="button"
            onClick={clearFilters}
            className={TABLE_FILTER_CLEAR_CLASS}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(false)}
            className={TABLE_FILTER_CLEAR_CLASS}
          >
            Hide Filters
          </button>
        </TableFilterBar>
      ) : null}

      {notice ? <p className="mt-4 text-sm text-success">{notice}</p> : null}

      {!showFilters || selectedCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {selectedCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-ink-muted">{selectedCount} selected</p>
              <button
                type="button"
                className={bulkBtn}
                onClick={() => flash(`Sample only — export ${selectedCount}.`)}
              >
                Export
              </button>
              <button
                type="button"
                className={bulkBtn}
                onClick={() => flash(`Sample only — disable ${selectedCount}.`)}
              >
                Disable
              </button>
              <button
                type="button"
                className={dangerBulkBtn}
                onClick={() => flash(`Sample only — delete ${selectedCount}.`)}
              >
                Delete
              </button>
              <button
                type="button"
                className={bulkBtn}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </div>
          ) : (
            <span />
          )}
          {!showFilters ? (
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className={TABLE_FILTER_CLEAR_CLASS}
            >
              Show Filters
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleAll}
                  disabled={pageIds.length === 0}
                  aria-label="Select all rows on this page"
                  className="size-4 accent-accent"
                />
              </th>
              <SortTh
                label="Name"
                active={table.sortKey === "name"}
                dir={table.sortDir}
                onSort={() => table.onSort("name")}
              />
              <SortTh
                label="Type"
                active={table.sortKey === "type"}
                dir={table.sortDir}
                onSort={() => table.onSort("type")}
              />
              <SortTh
                label="Status"
                active={table.sortKey === "status"}
                dir={table.sortDir}
                onSort={() => table.onSort("status")}
              />
              <SortTh
                label="Venue"
                active={table.sortKey === "venue"}
                dir={table.sortDir}
                onSort={() => table.onSort("venue")}
              />
              <SortTh
                label="Updated"
                active={table.sortKey === "updated"}
                dir={table.sortDir}
                onSort={() => table.onSort("updated")}
              />
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-ink-muted">
                  No rows match these filters.
                </td>
              </tr>
            ) : (
              pageRows.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleRow(item.id)}
                      aria-label={`Select ${item.name}`}
                      className="size-4 accent-accent"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{item.type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={statusLabel(item.status)}
                      status={item.status}
                    />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{item.venue}</td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {item.updated}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={actionLink}>
                        Edit
                      </button>
                      <button type="button" className={actionLink}>
                        Open
                      </button>
                      <button type="button" className={dangerLink}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <TablePager
          align="center"
          className="border-t border-line px-4 py-3"
          window={table.window}
          onPrev={() => table.setPage(table.window.page - 1)}
          onNext={() => table.setPage(table.window.page + 1)}
        />
      </div>
    </div>
  );
}

function statusLabel(status: SampleStatus): string {
  if (status === "active") {
    return "Active";
  }
  if (status === "disabled") {
    return "Disabled";
  }
  if (status === "pending") {
    return "Pending";
  }
  return "Error";
}
