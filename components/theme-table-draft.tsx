"use client";

import { useMemo, useState } from "react";

const PAGE_SIZE = 10;

const filterFieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
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

export function ThemeTableDraft() {
  const [draftQuery, setDraftQuery] = useState("");
  const [draftType, setDraftType] = useState("all");
  const [draftStatus, setDraftStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
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

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "updated") {
        return (a.updatedMs - b.updatedMs) * dir;
      }
      return a[sort.key].localeCompare(b[sort.key]) * dir;
    });
    return copy;
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const from = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, sorted.length);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageIds = pageRows.map((item) => item.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selectedCount = selected.size;

  function applyFilters() {
    setQuery(draftQuery);
    setTypeFilter(draftType);
    setStatusFilter(draftStatus);
    setPage(1);
    setSelected(new Set());
  }

  function clearFilters() {
    setDraftQuery("");
    setDraftType("all");
    setDraftStatus("all");
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPage(1);
    setSelected(new Set());
  }

  function onSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
    setPage(1);
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

      <form
        className="mt-6 rounded-card border border-line bg-surface p-4"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs text-ink-muted">
            Search
            <input
              type="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Name or venue"
              autoComplete="off"
              className={filterFieldClass}
            />
          </label>
          <label className="block text-xs text-ink-muted">
            Type
            <select
              value={draftType}
              onChange={(event) => setDraftType(event.target.value)}
              className={filterFieldClass}
            >
              <option value="all">All</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-ink-muted">
            Status
            <select
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value)}
              className={filterFieldClass}
            >
              <option value="all">All</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={primaryBtn}>
            Apply filters
          </button>
          <button type="button" onClick={clearFilters} className={secondaryBtn}>
            Clear
          </button>
        </div>
      </form>

      {notice ? <p className="mt-4 text-sm text-success">{notice}</p> : null}

      {selectedCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
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
              <SortTh label="Name" k="name" sort={sort} onSort={onSort} />
              <SortTh label="Type" k="type" sort={sort} onSort={onSort} />
              <SortTh label="Status" k="status" sort={sort} onSort={onSort} />
              <SortTh label="Venue" k="venue" sort={sort} onSort={onSort} />
              <SortTh label="Updated" k="updated" sort={sort} onSort={onSort} />
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
                    <StatusBadge status={item.status} />
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
        <p>
          {sorted.length === 0
            ? "No rows."
            : `Showing ${from}–${to} of ${sorted.length}`}
        </p>
        {pageCount > 1 ? (
          <div className="flex gap-2">
            {safePage > 1 ? (
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
              >
                Previous
              </button>
            ) : null}
            {safePage < pageCount ? (
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
              >
                Next
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(k)}
        className={active ? "text-ink" : "text-ink-faint hover:text-ink"}
      >
        {label}
        {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function StatusBadge({ status }: { status: SampleStatus }) {
  const className =
    status === "active"
      ? "rounded-full bg-success/15 px-2.5 py-0.5 text-xs text-success"
      : status === "disabled"
        ? "rounded-full bg-ink-faint/15 px-2.5 py-0.5 text-xs text-ink-muted"
        : status === "pending"
          ? "rounded-full bg-warning/15 px-2.5 py-0.5 text-xs text-warning"
          : "rounded-full bg-danger/15 px-2.5 py-0.5 text-xs text-danger";
  return <span className={className}>{statusLabel(status)}</span>;
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
