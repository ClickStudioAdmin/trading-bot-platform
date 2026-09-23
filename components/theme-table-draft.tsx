"use client";

import { useMemo, useState } from "react";
import {
  IconClose,
  IconDisable,
  IconDownload,
  IconFilterClear,
  IconOpen,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@/components/icons";
import {
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TABLE_TITLE_CASE_TH_CLASS,
  TableCard,
  TableFilterBar,
  TableFilterField,
  TableFilterSession,
  TableSectionTitle,
  TableActions,
  TableIconAction,
  TableLabelButton,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";
import { AppSelect } from "@/components/app-select";
import { AppCheck } from "@/components/app-check";
import { TableColumnPicker } from "@/components/table-column-picker";

const THEME_OPTIONAL_COLUMNS = [
  { id: "type", label: "Desk Type" },
  { id: "status", label: "Status" },
  { id: "venue", label: "Venue" },
  { id: "updated", label: "Updated" },
] as const;

type ThemeOptionalColumn = (typeof THEME_OPTIONAL_COLUMNS)[number]["id"];

const THEME_COLUMN_DEFAULTS: Record<ThemeOptionalColumn, boolean> = {
  type: true,
  status: true,
  venue: true,
  updated: true,
};

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [columns, setColumns] = useState(THEME_COLUMN_DEFAULTS);
  const visibleColumnCount =
    3 + THEME_OPTIONAL_COLUMNS.filter((column) => columns[column.id]).length;

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
    pageSize: 5,
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
      <TableFilterSession
        title={
          <TableSectionTitle
            title="Sample table"
            subtitle="Dummy rows only. Filters, sort, paging, and bulk actions work here so you can see the chrome. Live tables omit pieces they do not need."
          />
        }
        toolbar={
          selectedCount > 0 ? (
            <>
              <p className="text-sm text-ink-muted">{selectedCount} selected</p>
              <TableLabelButton
                variant="bulk"
                icon={<IconDownload {...TABLE_BTN_ICON} />}
                onClick={() => flash(`Sample only — export ${selectedCount}.`)}
              >
                Export
              </TableLabelButton>
              <TableLabelButton
                variant="bulk"
                icon={<IconDisable {...TABLE_BTN_ICON} />}
                onClick={() => flash(`Sample only — disable ${selectedCount}.`)}
              >
                Disable
              </TableLabelButton>
              <TableLabelButton
                variant="danger"
                icon={<IconTrash {...TABLE_BTN_ICON} />}
                onClick={() => flash(`Sample only — delete ${selectedCount}.`)}
              >
                Delete
              </TableLabelButton>
              <TableLabelButton
                variant="bulk"
                icon={<IconClose {...TABLE_BTN_ICON} />}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </TableLabelButton>
            </>
          ) : undefined
        }
        actions={
          <>
            <TableColumnPicker
              columns={THEME_OPTIONAL_COLUMNS}
              visible={columns}
              onToggle={(id, on) =>
                setColumns((current) => ({
                  ...current,
                  [id]: on,
                }))
              }
            />
            <TableLabelButton
              variant="secondary"
              icon={<IconDownload {...TABLE_BTN_ICON} />}
            >
              Export all
            </TableLabelButton>
            <TableLabelButton variant="primary" icon={<IconPlus {...TABLE_BTN_ICON} />}>
              New item
            </TableLabelButton>
          </>
        }
      >
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
            <TableFilterField label="Desk Type">
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
            <TableLabelButton
              variant="filter"
              icon={<IconFilterClear {...TABLE_BTN_ICON} />}
              onClick={clearFilters}
            >
              Clear
            </TableLabelButton>
          </TableFilterBar>
      </TableFilterSession>

      {notice ? <p className="mt-4 text-sm text-success">{notice}</p> : null}

      <TableCard
        className="mt-0"
        pager={
          <TablePager
            align="center"
            buttons="icons"
            window={table.window}
            onPage={(page) => table.setPage(page)}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
          />
        }
      >
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="w-10 px-4 py-3">
                <AppCheck
                  checked={allPageSelected}
                  onChange={toggleAll}
                  disabled={pageIds.length === 0}
                  aria-label="Select all rows on this page"
                  className=""
                />
              </th>
              <SortTh
                label="Name"
                active={table.sortKey === "name"}
                dir={table.sortDir}
                onSort={() => table.onSort("name")}
              />
              {columns.type ? (
                <SortTh
                  label="Desk Type"
                  className={TABLE_TITLE_CASE_TH_CLASS}
                  active={table.sortKey === "type"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("type")}
                />
              ) : null}
              {columns.status ? (
                <SortTh
                  label="Status"
                  active={table.sortKey === "status"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("status")}
                />
              ) : null}
              {columns.venue ? (
                <SortTh
                  label="Venue"
                  active={table.sortKey === "venue"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("venue")}
                />
              ) : null}
              {columns.updated ? (
                <SortTh
                  label="Updated"
                  active={table.sortKey === "updated"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("updated")}
                />
              ) : null}
              <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnCount} className="px-4 py-6 text-sm text-ink-muted">
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
                    <AppCheck
                      checked={selected.has(item.id)}
                      onChange={() => toggleRow(item.id)}
                      aria-label={`Select ${item.name}`}
                      className=""
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                  {columns.type ? (
                    <td className="px-4 py-3 text-ink-muted">{item.type}</td>
                  ) : null}
                  {columns.status ? (
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={statusLabel(item.status)}
                        status={item.status}
                      />
                    </td>
                  ) : null}
                  {columns.venue ? (
                    <td className="px-4 py-3 text-ink-muted">{item.venue}</td>
                  ) : null}
                  {columns.updated ? (
                    <td className="px-4 py-3 tabular-nums text-ink-muted">
                      {item.updated}
                    </td>
                  ) : null}
                  <td className={TABLE_ACTIONS_TD_CLASS}>
                    <TableActions>
                      <TableIconAction
                        label="Edit"
                        detail="Change this item's settings."
                      >
                        <IconPencil {...TABLE_BTN_ICON} />
                      </TableIconAction>
                      <TableIconAction
                        label="Open"
                        detail="Go to this item."
                      >
                        <IconOpen {...TABLE_BTN_ICON} />
                      </TableIconAction>
                      <TableIconAction
                        label="Delete"
                        detail="Remove this item."
                        danger
                      >
                        <IconTrash {...TABLE_BTN_ICON} />
                      </TableIconAction>
                    </TableActions>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
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
