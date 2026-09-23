"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { AppSelect } from "@/components/app-select";
import {
  AutomationsColumnPicker,
  useAutomationsColumns,
} from "@/components/automations-column-picker";
import { useConfirmDialog } from "@/components/confirm-modal";
import {
  IconCopy,
  IconFilterClear,
  IconPencil,
  IconPerformance,
  IconPositions,
  IconTrash,
} from "@/components/icons";
import {
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TABLE_THEAD_CLASS,
  TABLE_TITLE_CASE_TH_CLASS,
  TableActions,
  TableCard,
  TableFilterBar,
  TableFilterField,
  TableFilterSession,
  TableIconAction,
  TableLabelButton,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import {
  EMPTY_AUTOMATIONS_BOT_FILTERS,
  automationsBotFiltersActive,
  compareAutomationsBot,
  filterAutomationsBots,
  type AutomationsBotFilters,
} from "@/lib/bots/automations-list";
import { statusOptionsFor, type BotDeskKind } from "@/lib/bots/status";
import { formatCount, formatPct, signedTone } from "@/lib/opportunities/format";
import { statusToneFor } from "@/lib/table-chrome";

export type AutomationsBotRow = {
  id: string;
  name: string;
  pair: string;
  status: string;
  statusKey?: string;
  summary: string;
  positionCount: number;
  roePct: number | null;
  positionsHref: string;
  performanceHref: string;
  editHref: string;
  cloneHref?: string;
  canRemove?: boolean;
  removeBlocked?: string;
  onRemove?: () => void | Promise<void>;
};

function AutomationsBotFiltersBar({
  desk,
  values,
  onChange,
  onClear,
}: {
  desk: BotDeskKind;
  values: AutomationsBotFilters;
  onChange: (key: keyof AutomationsBotFilters, value: string) => void;
  onClear: () => void;
}) {
  const statuses = statusOptionsFor(desk);
  return (
    <TableFilterBar>
      <TableFilterField label="Name">
        <input
          type="search"
          value={values.q}
          onChange={(event) => onChange("q", event.target.value)}
          placeholder="Bot name"
          autoComplete="off"
          className={TABLE_FILTER_FIELD_CLASS}
        />
      </TableFilterField>
      <TableFilterField label="Pair">
        <input
          type="search"
          value={values.pair}
          onChange={(event) => onChange("pair", event.target.value)}
          placeholder="Contract or side"
          autoComplete="off"
          className={TABLE_FILTER_FIELD_CLASS}
        />
      </TableFilterField>
      <TableFilterField label="Status">
        <AppSelect
          value={values.status}
          onChange={(event) => onChange("status", event.target.value)}
          className={TABLE_FILTER_FIELD_CLASS}
        >
          <option value="">All</option>
          {statuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </AppSelect>
      </TableFilterField>
      <TableLabelButton
        variant="filter"
        icon={<IconFilterClear {...TABLE_BTN_ICON} />}
        onClick={onClear}
      >
        Clear
      </TableLabelButton>
    </TableFilterBar>
  );
}

export function AutomationsBotTable({
  desk,
  rows,
  empty,
  toolbar,
}: {
  desk: BotDeskKind;
  rows: readonly AutomationsBotRow[];
  empty: string;
  toolbar?: ReactNode;
}) {
  const { confirm, dialog } = useConfirmDialog();
  const { visible, setColumn } = useAutomationsColumns();
  const [filters, setFilters] = useState(EMPTY_AUTOMATIONS_BOT_FILTERS);
  const filtered = useMemo(
    () => filterAutomationsBots(rows, filters),
    [filters, rows],
  );
  const table = useClientTable(filtered, compareAutomationsBot, {
    defaultKey: "name",
  });
  const filtersActive = automationsBotFiltersActive(filters);

  function changeFilter(key: keyof AutomationsBotFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    table.setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_AUTOMATIONS_BOT_FILTERS);
    table.setPage(1);
  }
  const colSpan =
    2 +
    Number(visible.pair) +
    Number(visible.recipe) +
    Number(visible.status) +
    Number(visible.positions) +
    Number(visible.performance);

  async function removeRow(row: AutomationsBotRow) {
    if (!row.onRemove || row.canRemove === false) {
      return;
    }
    const ok = await confirm({
      title: "Remove this bot?",
      message: "This cannot be undone.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) {
      return;
    }
    await row.onRemove();
  }

  return (
    <>
    {dialog}
    <TableFilterSession
      actions={
        <>
          {toolbar}
          <AutomationsColumnPicker visible={visible} setColumn={setColumn} />
        </>
      }
    >
      <AutomationsBotFiltersBar
        desk={desk}
        values={filters}
        onChange={changeFilter}
        onClear={clearFilters}
      />
    </TableFilterSession>
    <TableCard
      className="mt-0"
      pager={
        <TablePager
          window={table.window}
          onPrev={() => table.setPage(table.window.page - 1)}
          onNext={() => table.setPage(table.window.page + 1)}
        />
      }
    >
      <table className="min-w-full text-left text-sm text-ink">
        <thead className={`${TABLE_THEAD_CLASS} text-hint text-ink-muted`}>
          <tr>
            <SortTh
              label="Name"
              className={TABLE_TITLE_CASE_TH_CLASS}
              active={table.sortKey === "name"}
              dir={table.sortDir}
              onSort={() => table.onSort("name")}
            />
            {visible.pair ? (
              <SortTh
                label="Pair / Side"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "pair"}
                dir={table.sortDir}
                onSort={() => table.onSort("pair")}
              />
            ) : null}
            {visible.recipe ? (
              <SortTh
                label="Recipe"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "recipe"}
                dir={table.sortDir}
                onSort={() => table.onSort("recipe")}
              />
            ) : null}
            {visible.status ? (
              <SortTh
                label="Status"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "status"}
                dir={table.sortDir}
                onSort={() => table.onSort("status")}
              />
            ) : null}
            {visible.positions ? (
              <SortTh
                label="Positions"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "positions"}
                dir={table.sortDir}
                onSort={() => table.onSort("positions")}
              />
            ) : null}
            {visible.performance ? (
              <SortTh
                label="Performance"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "performance"}
                dir={table.sortDir}
                onSort={() => table.onSort("performance")}
              />
            ) : null}
            <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="px-4 py-6 text-sm text-ink-muted"
              >
                {filtersActive ? "No bots match these filters." : empty}
              </td>
            </tr>
          ) : (
          table.pageRows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-b-0">
              <td className="px-4 py-3 pr-8 align-top">
                <Link
                  href={row.editHref}
                  className="text-ink hover:underline"
                >
                  {row.name || "Bot"}
                </Link>
              </td>
              {visible.pair ? (
                <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                  {row.pair}
                </td>
              ) : null}
              {visible.recipe ? (
                <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                  {row.summary}
                </td>
              ) : null}
              {visible.status ? (
                <td className="px-4 py-3 pr-8 align-top">
                  <StatusBadge
                    label={row.status}
                    tone={statusToneFor(row.statusKey ?? row.status)}
                  />
                </td>
              ) : null}
              {visible.positions ? (
                <td className="px-4 py-3 pr-8 align-top">
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-nums">
                      {formatCount(row.positionCount)}
                    </span>
                    <TableIconAction
                      href={row.positionsHref}
                      label="Positions"
                      detail="Open this bot’s positions."
                    >
                      <IconPositions {...TABLE_BTN_ICON} />
                    </TableIconAction>
                  </div>
                </td>
              ) : null}
              {visible.performance ? (
                <td className="px-4 py-3 pr-8 align-top">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`tabular-nums ${signedTone(row.roePct)}`}
                    >
                      {row.roePct == null ? "—" : formatPct(row.roePct)}
                    </span>
                    <TableIconAction
                      href={row.performanceHref}
                      label="Performance"
                      detail="Open this bot’s realized ROE."
                    >
                      <IconPerformance {...TABLE_BTN_ICON} />
                    </TableIconAction>
                  </div>
                </td>
              ) : null}
              <td className={`${TABLE_ACTIONS_TD_CLASS} align-top`}>
                <TableActions>
                  <TableIconAction
                    href={row.editHref}
                    label="View / Edit"
                    detail="Open this bot’s form."
                  >
                    <IconPencil {...TABLE_BTN_ICON} />
                  </TableIconAction>
                  {row.cloneHref ? (
                    <TableIconAction
                      href={row.cloneHref}
                      label="Clone"
                      detail="Create a new bot from this one."
                    >
                      <IconCopy {...TABLE_BTN_ICON} />
                    </TableIconAction>
                  ) : null}
                  {row.onRemove ? (
                    <TableIconAction
                      danger
                      disabled={row.canRemove === false}
                      label="Remove"
                      detail={
                        row.canRemove === false
                          ? (row.removeBlocked ??
                            "This bot cannot be removed.")
                          : "Delete this bot."
                      }
                      onClick={() => void removeRow(row)}
                    >
                      <IconTrash {...TABLE_BTN_ICON} />
                    </TableIconAction>
                  ) : null}
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
