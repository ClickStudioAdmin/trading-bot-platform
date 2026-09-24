"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppSelect } from "@/components/app-select";
import {
  AutomationsColumnPicker,
  useAutomationsColumns,
} from "@/components/automations-column-picker";
import { useConfirmDialog } from "@/components/confirm-modal";
import {
  IconActivity,
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
  TableSectionTitle,
  useClientTable,
} from "@/components/table-chrome";
import { DESK_QUERY } from "@/lib/accounts/model";
import {
  DEFAULT_AUTOMATIONS_LIST_VIEW,
  EMPTY_AUTOMATIONS_BOT_FILTERS,
  automationsBotFiltersActive,
  automationsListViewKey,
  parseAutomationsListView,
  serializeAutomationsListView,
  type AutomationsListView,
  compareAutomationsBot,
  filterAutomationsBots,
  type AutomationsBotFilters,
} from "@/lib/bots/automations-list";
import { statusOptionsFor, type BotDeskKind } from "@/lib/bots/status";

function readAutomationsListView(key: string): AutomationsListView | null {
  try {
    return parseAutomationsListView(window.sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeAutomationsListView(key: string, view: AutomationsListView) {
  try {
    window.sessionStorage.setItem(key, serializeAutomationsListView(view));
  } catch {
    // ignore quota / private mode
  }
}
import { formatCount, formatPct, signedTone } from "@/lib/opportunities/format";
import { TokenIcon } from "@/components/token-icon";
import { ColumnHint } from "@/components/column-hint";
import { ExpandableTradeRows } from "@/components/trade-expand";
import type { BotConfigSection } from "@/lib/bots/bot-config";
import {
  statusToneFor,
  tablePageForIndex,
  type TableSortDir,
} from "@/lib/table-chrome";

export type AutomationsBotRow = {
  id: string;
  name: string;
  pair: string;
  /** Set for a locked contract (DCA, Perps). Cash and Carry leaves this empty. */
  baseCoin?: string;
  pairNote?: string;
  status: string;
  statusKey?: string;
  summary: string;
  config: readonly BotConfigSection[];
  positionCount: number;
  roePct: number | null;
  positionsHref: string;
  performanceHref: string;
  activityHref: string;
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
  revealId = null,
}: {
  desk: BotDeskKind;
  rows: readonly AutomationsBotRow[];
  empty: string;
  toolbar?: ReactNode;
  revealId?: string | null;
}) {
  const { confirm, dialog } = useConfirmDialog();
  const { visible, setColumn } = useAutomationsColumns();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deskId = searchParams.get(DESK_QUERY) ?? "";
  const storageKey = automationsListViewKey(pathname, deskId);
  const [filters, setFilters] = useState(EMPTY_AUTOMATIONS_BOT_FILTERS);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const filtered = useMemo(
    () => filterAutomationsBots(rows, filters),
    [filters, rows],
  );
  const table = useClientTable(filtered, compareAutomationsBot, {
    defaultKey: "name",
  });
  const appliedKey = useRef<string | null>(null);
  const pendingScroll = useRef<number | null>(null);
  const scrolledKey = useRef<string | null>(null);
  const scrollY = useRef(0);
  const leaving = useRef(false);
  const snap = useRef<AutomationsListView>(DEFAULT_AUTOMATIONS_LIST_VIEW);

  useLayoutEffect(() => {
    if (appliedKey.current === storageKey) {
      return;
    }
    appliedKey.current = storageKey;
    scrolledKey.current = null;
    const saved = readAutomationsListView(storageKey);
    const next = saved ?? DEFAULT_AUTOMATIONS_LIST_VIEW;
    setFilters(next.filters);
    table.replaceView({
      sortKey: next.sortKey,
      sortDir: next.sortDir,
      page: next.page,
    });
    scrollY.current = next.scrollY;
    pendingScroll.current = revealId ? null : next.scrollY;
    leaving.current = false;
    setRestoredKey(storageKey);
  }, [revealId, storageKey, table]);

  useEffect(() => {
    snap.current = {
      filters,
      sortKey: table.sortKey,
      sortDir: table.sortDir,
      page: table.window.page,
      scrollY: 0,
    };
  }, [filters, table.sortDir, table.sortKey, table.window.page]);

  useLayoutEffect(() => {
    if (restoredKey !== storageKey || pendingScroll.current == null) {
      return;
    }
    if (scrolledKey.current === storageKey) {
      return;
    }
    scrolledKey.current = storageKey;
    const y = pendingScroll.current;
    pendingScroll.current = null;
    window.scrollTo(0, y);
    const frame = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => cancelAnimationFrame(frame);
  }, [filters, restoredKey, storageKey, table.window.page]);

  useEffect(() => {
    if (restoredKey !== storageKey) {
      return;
    }
    writeAutomationsListView(storageKey, {
      filters,
      sortKey: table.sortKey,
      sortDir: table.sortDir,
      page: table.window.page,
      scrollY: scrollY.current,
    });
  }, [
    filters,
    restoredKey,
    storageKey,
    table.sortDir,
    table.sortKey,
    table.window.page,
  ]);

  useEffect(() => {
    if (restoredKey !== storageKey) {
      return;
    }
    let frame = 0;
    const persist = () => {
      writeAutomationsListView(storageKey, {
        ...snap.current,
        scrollY: scrollY.current,
      });
    };
    const onScroll = () => {
      if (leaving.current) {
        return;
      }
      scrollY.current = window.scrollY;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(persist);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(target instanceof Element) ||
        !target.closest("a")
      ) {
        return;
      }
      leaving.current = true;
      scrollY.current = window.scrollY;
      persist();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", persist);
    document.addEventListener("click", onClick, true);
    return () => {
      cancelAnimationFrame(frame);
      persist();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("click", onClick, true);
    };
  }, [restoredKey, storageKey]);

  const revealPage = revealPageFor(
    filtered,
    revealId ?? null,
    table.sortKey,
    table.sortDir,
  );
  const revealedToken = useRef<string | null>(null);
  const revealToken = `${revealId ?? ""}:${filters.q}:${filters.pair}:${filters.status}:${table.sortKey}:${table.sortDir}`;
  useLayoutEffect(() => {
    if (!revealId || revealPage == null || revealedToken.current === revealToken) {
      return;
    }
    revealedToken.current = revealToken;
    if (table.window.page !== revealPage) {
      table.setPage(revealPage);
    }
  }, [revealId, revealPage, revealToken, table]);
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
    3 +
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
      id={deskId}
      title={<TableSectionTitle title="Bots" />}
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
          onPage={(page) => table.setPage(page)}
          onPrev={() => table.setPage(table.window.page - 1)}
          onNext={() => table.setPage(table.window.page + 1)}
        />
      }
    >
      <table className="min-w-full text-left text-sm text-ink">
        <thead className={`${TABLE_THEAD_CLASS} text-hint text-ink-muted`}>
          <tr>
            <th className="w-10 px-2 py-3 font-medium">
              <ColumnHint
                label={<span className="sr-only">Details</span>}
                hint="Expand for this bot’s configuration."
              />
            </th>
            {visible.pair ? (
              <SortTh
                label="Pair"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "pair"}
                dir={table.sortDir}
                onSort={() => table.onSort("pair")}
              />
            ) : null}
            <SortTh
              label="Name"
              className={TABLE_TITLE_CASE_TH_CLASS}
              active={table.sortKey === "name"}
              dir={table.sortDir}
              onSort={() => table.onSort("name")}
            />
            {visible.recipe ? (
              <SortTh
                label="Side / Recipe"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "recipe"}
                dir={table.sortDir}
                onSort={() => table.onSort("recipe")}
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
            {visible.status ? (
              <SortTh
                label="Status"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "status"}
                dir={table.sortDir}
                onSort={() => table.onSort("status")}
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
            <ExpandableTradeRows
              key={row.id}
              colSpan={colSpan}
              detailName="bot configuration"
              selected={Boolean(revealId && row.id === revealId)}
              details={<BotConfigPanel sections={row.config} />}
            >
              {visible.pair ? (
                <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                  <BotPairCell row={row} />
                </td>
              ) : null}
              <td className="px-4 py-3 pr-8 align-top">
                <Link
                  href={row.editHref}
                  className="text-ink hover:underline"
                >
                  {row.name || "Bot"}
                </Link>
              </td>
              {visible.recipe ? (
                <td className="px-4 py-3 pr-8 align-top">
                  <BotRecipeCell row={row} />
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
                      detail="See this bot’s current positions."
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
                      detail="See this bot’s full performance."
                    >
                      <IconPerformance {...TABLE_BTN_ICON} />
                    </TableIconAction>
                  </div>
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
              <td className={`${TABLE_ACTIONS_TD_CLASS} align-top`}>
                <TableActions>
                  <TableIconAction
                    href={row.activityHref}
                    label="Activity"
                    detail="See this bot’s activity."
                  >
                    <IconActivity {...TABLE_BTN_ICON} />
                  </TableIconAction>
                  <TableIconAction
                    href={row.editHref}
                    label="Edit"
                    detail="Modify the bot’s parameters/status."
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
            </ExpandableTradeRows>
          ))
          )}
        </tbody>
      </table>
    </TableCard>
    </>
  );
}

function BotConfigPanel({
  sections,
}: {
  sections: readonly BotConfigSection[];
}) {
  if (sections.length === 0) {
    return (
      <p className="text-sm text-ink-muted">No configuration saved.</p>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {sections.map((section) => (
        <section key={section.title} className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
          <dl className="mt-2 space-y-1.5">
            {section.lines.map((line) => (
              <div
                key={line.label}
                className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] gap-3 text-sm"
              >
                <dt className="text-ink-muted">{line.label}</dt>
                <dd
                  className={
                    line.value === "Off" ? "text-ink-muted" : "text-ink"
                  }
                >
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function pairSideClass(side: string): string {
  const key = side.trim().toLowerCase();
  if (key === "long" || key === "buy" || key.endsWith(" long")) {
    return "text-success";
  }
  if (key === "short" || key === "sell" || key.endsWith(" short")) {
    return "text-danger";
  }
  return "text-ink-muted";
}

function splitPairSide(pair: string): { contract: string; side: string | null } {
  const mark = " · ";
  const at = pair.lastIndexOf(mark);
  if (at < 0) {
    return { contract: pair, side: null };
  }
  return {
    contract: pair.slice(0, at),
    side: pair.slice(at + mark.length),
  };
}

function BotPairLine({ pair }: { pair: string }) {
  const { contract, side } = splitPairSide(pair);
  return (
    <span className="mt-0.5 block truncate text-hint text-ink-muted">
      {side ? contract : pair}
    </span>
  );
}

function BotRecipeCell({ row }: { row: AutomationsBotRow }) {
  const { side } = splitPairSide(row.pair);
  if (!side) {
    return <span className="text-ink-muted">{row.summary}</span>;
  }
  return (
    <span className="block min-w-0">
      <span className={`block font-medium ${pairSideClass(side)}`}>{side}</span>
      <span className="mt-0.5 block truncate text-hint text-ink-muted">
        {row.summary}
      </span>
    </span>
  );
}

function BotPairCell({ row }: { row: AutomationsBotRow }) {
  const note = row.pairNote ? (
    <span className="mt-0.5 block text-hint text-warning">{row.pairNote}</span>
  ) : null;
  if (!row.baseCoin) {
    return (
      <>
        <span>{row.pair}</span>
        {note}
      </>
    );
  }
  return (
    <span className="flex items-start gap-2">
      <TokenIcon symbol={row.baseCoin} />
      <span className="min-w-0">
        <span className="block font-medium text-ink">{row.baseCoin}</span>
        <BotPairLine pair={row.pair} />
        {note}
      </span>
    </span>
  );
}

function revealPageFor(
  rows: readonly AutomationsBotRow[],
  revealId: string | null,
  sortKey: string,
  sortDir: TableSortDir,
): number | null {
  if (!revealId) {
    return null;
  }
  const sorted = [...rows].sort((left, right) =>
    compareAutomationsBot(left, right, sortKey, sortDir),
  );
  const index = sorted.findIndex((row) => row.id === revealId);
  return index < 0 ? null : tablePageForIndex(index);
}
