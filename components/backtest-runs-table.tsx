"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useConfirmDialog } from "@/components/confirm-modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClickGateNotice, useClickGate } from "@/components/click-gate-notice";
import { useResearchGateAccess } from "@/components/research-gate-access";
import { replayClickDenial } from "@/lib/membership/entitlements";
import {
  DetachBacktestButton,
  RemoveBacktestButton,
} from "@/components/backtest-run-view";
import {
  BotButtonLead,
  botBtnIcon,
  deskActionBtnClass,
} from "@/components/bot-form-chrome";
import {
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconCornerDownRight,
  IconFilterClear,
  IconPlay,
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
  TableActions,
  TableCard,
  TableFilterBar,
  TableFilterField,
  TableFilterSession,
  TableHint,
  TableIconAction,
  TableLabelButton,
  TablePager,
  useActionHint,
  useClientTable,
} from "@/components/table-chrome";
import { AppCheck } from "@/components/app-check";
import { TemplateParametersButton } from "@/components/template-parameters-tip";
import { TokenIcon } from "@/components/token-icon";
import { deleteBacktestRunsAction } from "@/lib/backtest/actions";
import { pruneRemovedIds, withRemovedIds } from "@/lib/table-chrome";
import {
  backtestAprPct,
  backtestNewHref,
  backtestRoePct,
  backtestRunTitle,
  backtestRunWasLiquidated,
  backtestSavedListHref,
  backtestWindowDays,
  canDeleteBacktestRun,
  filterSavedBacktestFamilies,
  formatBacktestReturnPct,
  savedBacktestChildBadge,
  savedBacktestFamilies,
  savedBacktestListRows,
  type BacktestDeskType,
  type BacktestRun,
  type BacktestStatus,
  type SavedBacktestChildRole,
  type SavedBacktestFamily,
  type SavedBacktestListRow,
} from "@/lib/backtest/model";
import { formatCount, signedTone } from "@/lib/opportunities/format";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";
import { AppSelect } from "@/components/app-select";
import { formatDeskType } from "@/lib/accounts/model";
import {
  backtestDeskFilterChoices,
  backtestDeskFilterLabel,
  backtestDeskTypeFilterChoices,
  type BacktestListDesk,
} from "@/lib/backtest/library";

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function backtestListTitle(
  row: BacktestRun,
  mode: "family" | "recipe",
): string {
  const stored = row.name?.trim();
  if (stored) {
    return stored;
  }
  if (mode === "recipe") {
    return row.recipe.name.trim() || "Backtest";
  }
  return backtestRunTitle(row);
}

const STATUS_FILTERS: Array<BacktestStatus | "all"> = [
  "all",
  "queued",
  "running",
  "done",
  "failed",
  "cancelled",
  "draft",
];

function deskTypeFilterLabel(value: BacktestDeskType | "all"): string {
  return value === "all" ? "All desk types" : formatDeskType(value);
}

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

function runWinRate(row: BacktestRun): number | null {
  return row.stats && row.stats.trades > 0 ? row.stats.winRate : null;
}

function runRoe(row: BacktestRun): number | null {
  return row.stats
    ? backtestRoePct(row.stats.realizedUsdt, row.orders, row.leverage)
    : null;
}

function runApr(row: BacktestRun): number | null {
  return row.stats
    ? backtestAprPct(
        row.stats.realizedUsdt,
        row.stats.startingUsdt,
        row.fromMs,
        row.toMs,
      )
    : null;
}

function attachedTemplateLabel(
  row: BacktestRun,
  templates: Record<string, { name: string; href: string }>,
): string | null {
  const id = row.templateId?.trim();
  if (!id) {
    return null;
  }
  const name = templates[id]?.name?.trim();
  return name || null;
}

function attachedTemplateHref(
  row: BacktestRun,
  templates: Record<string, { name: string; href: string }>,
): string | null {
  const id = row.templateId?.trim();
  if (!id) {
    return null;
  }
  const href = templates[id]?.href?.trim();
  return href || null;
}

function compareTemplateNames(
  left: string | null,
  right: string | null,
  dir: TableSortDir,
): number {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  return compareTableText(left, right, dir);
}

function compareBacktestRun(
  left: BacktestRun,
  right: BacktestRun,
  key: string,
  dir: TableSortDir,
  templates: Record<string, { name: string; href: string }>,
): number {
  if (key === "name") {
    return compareTableText(backtestRunTitle(left), backtestRunTitle(right), dir);
  }
  if (key === "type") {
    return compareTableText(left.deskType, right.deskType, dir);
  }
  if (key === "contract") {
    return compareTableText(left.symbol, right.symbol, dir);
  }
  if (key === "template") {
    return compareTemplateNames(
      attachedTemplateLabel(left, templates),
      attachedTemplateLabel(right, templates),
      dir,
    );
  }
  if (key === "days") {
    return compareNullableNum(
      backtestWindowDays(left.fromMs, left.toMs),
      backtestWindowDays(right.fromMs, right.toMs),
      dir,
    );
  }
  if (key === "win") {
    return compareNullableNum(runWinRate(left), runWinRate(right), dir);
  }
  if (key === "roe") {
    return compareNullableNum(runRoe(left), runRoe(right), dir);
  }
  if (key === "apr") {
    return compareNullableNum(runApr(left), runApr(right), dir);
  }
  if (key === "status") {
    return compareTableText(left.status, right.status, dir);
  }
  return 0;
}

const BACKTEST_RUN_COLUMNS = 11;

export function BacktestRunsTable({
  runs: sourceRuns,
  memberId,
  isAdmin,
  primaryRunId,
  primaryBadge = "Primary Pair",
  childBadge,
  titleMode = "family",
  returnTo = "/account/backtests",
  watchRunId,
  empty = "No runs yet.",
  createHref,
  nestChildren = false,
  templates = {},
  desks,
  runDeskIds = {},
}: {
  runs: BacktestRun[];
  memberId: string;
  isAdmin: boolean;
  primaryRunId?: string;
  primaryBadge?: string;
  childBadge?: string;
  titleMode?: "family" | "recipe";
  returnTo?: string;
  watchRunId?: string;
  empty?: ReactNode;
  /** List page only. Comparables and variations omit it. */
  createHref?: string;
  /** Saved list. Comparables and variations render under the parent. */
  nestChildren?: boolean;
  /** Library templates keyed by `template_id`. Missing ids render as an em dash. */
  templates?: Record<string, { name: string; href: string }>;
  /** Saved list. Flex and DCA desks this member can backtest. */
  desks?: readonly BacktestListDesk[];
  /** Desk ids whose current bot still matches each run. */
  runDeskIds?: Readonly<Record<string, readonly string[]>>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | BacktestStatus>("all");
  const [deskId, setDeskId] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | BacktestDeskType>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const keptRemoved = pruneRemovedIds(
    removedIds,
    sourceRuns.map((run) => run.id),
  );
  if (keptRemoved !== removedIds) {
    setRemovedIds(keptRemoved);
  }
  if (
    deskId !== "all" &&
    desks &&
    !desks.some((desk) => desk.id === deskId)
  ) {
    setDeskId("all");
  }
  const deskChoices = useMemo(
    () => (desks ? backtestDeskFilterChoices(desks, typeFilter) : []),
    [desks, typeFilter],
  );
  const typeChoices = useMemo(
    () =>
      desks
        ? backtestDeskTypeFilterChoices(desks, deskId)
        : (["all", "flex", "dca"] as const),
    [desks, deskId],
  );
  const runs =
    keptRemoved.size === 0
      ? sourceRuns
      : sourceRuns.filter((run) => !keptRemoved.has(run.id));
  const gate = useResearchGateAccess();
  const clickGate = useClickGate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(
    () => new Set(),
  );
  const { confirm, dialog } = useConfirmDialog();
  const matchesRun = useCallback(
    (row: BacktestRun) => {
      if (status !== "all" && row.status !== status) {
        return false;
      }
      if (typeFilter !== "all" && row.deskType !== typeFilter) {
        return false;
      }
      if (deskId !== "all" && !(runDeskIds[row.id] ?? []).includes(deskId)) {
        return false;
      }
      const needle = query.trim().toLowerCase();
      if (!needle) {
        return true;
      }
      const hay = [
        backtestListTitle(row, titleMode),
        attachedTemplateLabel(row, templates) ?? "",
        row.symbol,
        row.deskType === "dca" ? "dca" : "flex",
        row.status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    },
    [deskId, query, runDeskIds, status, templates, titleMode, typeFilter],
  );
  const filteredFamilies = useMemo(() => {
    if (!nestChildren) {
      return [] as SavedBacktestFamily[];
    }
    return filterSavedBacktestFamilies(savedBacktestFamilies(runs), matchesRun);
  }, [matchesRun, nestChildren, runs]);
  const familyByHead = useMemo(() => {
    const map = new Map<string, SavedBacktestFamily>();
    for (const family of filteredFamilies) {
      map.set(family.head.id, family);
    }
    return map;
  }, [filteredFamilies]);
  const listRows = useMemo(() => {
    if (!nestChildren) {
      return runs
        .filter(matchesRun)
        .map((run) => ({ run, role: null }) satisfies SavedBacktestListRow);
    }
    return savedBacktestListRows(filteredFamilies, collapsedFamilies);
  }, [collapsedFamilies, filteredFamilies, matchesRun, nestChildren, runs]);
  const familySort = useMemo(() => {
    const map = new Map<
      string,
      { head: BacktestRun; familyIndex: number; childAt: Map<string, number> }
    >();
    filteredFamilies.forEach((family, familyIndex) => {
      const childAt = new Map(
        family.children.map((child, index) => [child.run.id, index]),
      );
      const info = { head: family.head, familyIndex, childAt };
      map.set(family.head.id, info);
      for (const child of family.children) {
        map.set(child.run.id, info);
      }
    });
    return map;
  }, [filteredFamilies]);
  const compare = useCallback(
    (left: BacktestRun, right: BacktestRun, key: string, dir: TableSortDir) => {
      if (key === "name") {
        return compareTableText(
          backtestListTitle(left, titleMode),
          backtestListTitle(right, titleMode),
          dir,
        );
      }
      return compareBacktestRun(left, right, key, dir, templates);
    },
    [templates, titleMode],
  );
  const compareList = useCallback(
    (
      left: SavedBacktestListRow,
      right: SavedBacktestListRow,
      key: string,
      dir: TableSortDir,
    ) => {
      if (!nestChildren) {
        return compare(left.run, right.run, key, dir);
      }
      const leftInfo = familySort.get(left.run.id);
      const rightInfo = familySort.get(right.run.id);
      if (!leftInfo || !rightInfo || leftInfo.head.id === rightInfo.head.id) {
        const leftAt =
          left.role == null ? -1 : (leftInfo?.childAt.get(left.run.id) ?? 0);
        const rightAt =
          right.role == null
            ? -1
            : (rightInfo?.childAt.get(right.run.id) ?? 0);
        return leftAt - rightAt;
      }
      const byHead = compare(leftInfo.head, rightInfo.head, key, dir);
      if (byHead !== 0) {
        return byHead;
      }
      return leftInfo.familyIndex - rightInfo.familyIndex;
    },
    [compare, familySort, nestChildren],
  );
  const table = useClientTable(listRows, compareList, { defaultKey: "name" });
  const pageEntries = table.pageRows;
  const listedEntries = listRows;
  const removableIds = pageEntries
    .filter((entry) => canDeleteBacktestRun(entry.run, memberId, isAdmin))
    .map((entry) => entry.run.id);
  const listedRemovableIds = listedEntries
    .filter((entry) => canDeleteBacktestRun(entry.run, memberId, isAdmin))
    .map((entry) => entry.run.id);
  const allSelected =
    removableIds.length > 0 && removableIds.every((id) => selected.has(id));
  const selectedCount = [...selected].filter((id) =>
    listedRemovableIds.includes(id),
  ).length;

  function toggleFamily(id: string) {
    setCollapsedFamilies((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const id of removableIds) {
          next.delete(id);
        }
      } else {
        for (const id of removableIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setDeskId("all");
    setTypeFilter("all");
    table.setPage(1);
  }

  const filtersActive =
    Boolean(query.trim()) ||
    status !== "all" ||
    deskId !== "all" ||
    typeFilter !== "all";

  async function deleteSelected() {
    if (selectedCount === 0 || pending) {
      return;
    }
    const label = selectedCount === 1 ? "backtest" : "backtests";
    const ok = await confirm({
      title: `Delete ${selectedCount} ${label}?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) {
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    const data = new FormData();
    for (const id of selected) {
      if (listedRemovableIds.includes(id)) {
        data.append("runId", id);
      }
    }
    const result = await deleteBacktestRunsAction(data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not remove those backtests.");
      return;
    }
    const deletedCurrent = Boolean(watchRunId && selected.has(watchRunId));
    if (!result.notes) {
      setRemovedIds((current) =>
        withRemovedIds(
          current,
          [...selected].filter((id) => listedRemovableIds.includes(id)),
        ),
      );
    }
    setSelected(new Set());
    if (result.notes?.[0]) {
      setMessage(result.notes[0]);
    }
    if (deletedCurrent) {
      router.push(backtestSavedListHref());
    }
    router.refresh();
  }

  return (
    <div>
      <ClickGateNotice
        access={clickGate.notice}
        anchorRef={clickGate.anchorRef}
        generation={clickGate.generation}
        onDismiss={clickGate.hide}
      />
      {dialog}
      <TableFilterSession
        toolbar={
          selectedCount > 0 ? (
            <>
              <p className="text-sm text-ink-muted">{selectedCount} selected</p>
              <TableLabelButton
                variant="danger"
                disabled={pending}
                icon={<IconTrash {...TABLE_BTN_ICON} />}
                onClick={() => void deleteSelected()}
              >
                {pending ? "Deleting…" : "Delete"}
              </TableLabelButton>
              <TableLabelButton
                variant="bulk"
                disabled={pending}
                icon={<IconClose {...TABLE_BTN_ICON} />}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </TableLabelButton>
            </>
          ) : undefined
        }
        actions={
          createHref ? (
            <button
              type="button"
              onClick={() => {
                router.push(createHref);
              }}
              className={`inline-flex items-center ${deskActionBtnClass}`}
            >
              <BotButtonLead icon={<IconPlus {...botBtnIcon} />}>
                Create New Backtest
              </BotButtonLead>
            </button>
          ) : undefined
        }
      >
          <TableFilterBar>
            <TableFilterField label="Search">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  table.setPage(1);
                }}
                placeholder="Name or contract"
                autoComplete="off"
                className={TABLE_FILTER_FIELD_CLASS}
              />
            </TableFilterField>
            <TableFilterField label="Desk Type">
              <AppSelect
                value={typeFilter}
                onChange={(event) => {
                  const next = event.target.value as "all" | BacktestDeskType;
                  setTypeFilter(next);
                  if (next !== "all" && deskId !== "all" && desks) {
                    const desk = desks.find((row) => row.id === deskId);
                    if (!desk || desk.deskType !== next) {
                      setDeskId("all");
                    }
                  }
                  table.setPage(1);
                }}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                {typeChoices.map((value) => (
                  <option key={value} value={value}>
                    {deskTypeFilterLabel(value)}
                  </option>
                ))}
              </AppSelect>
            </TableFilterField>
            {desks ? (
              <TableFilterField label="Desk">
                <AppSelect
                  value={deskId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDeskId(next);
                    if (next !== "all" && typeFilter !== "all") {
                      const desk = desks.find((row) => row.id === next);
                      if (!desk || desk.deskType !== typeFilter) {
                        setTypeFilter("all");
                      }
                    }
                    table.setPage(1);
                  }}
                  className={TABLE_FILTER_FIELD_CLASS}
                >
                  <option value="all">All desks</option>
                  {deskChoices.map((desk) => (
                    <option key={desk.id} value={desk.id}>
                      {backtestDeskFilterLabel(desk, desks)}
                    </option>
                  ))}
                </AppSelect>
              </TableFilterField>
            ) : null}
            <TableFilterField label="Status">
              <AppSelect
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as "all" | BacktestStatus);
                  table.setPage(1);
                }}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                {STATUS_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "All statuses" : statusLabel(value)}
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
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}
      <TableCard
        pager={
          <TablePager
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
                {removableIds.length > 0 ? (
                  <AppCheck
                    checked={allSelected}
                    onChange={toggleAll}
                    indeterminate={selectedCount > 0 && !allSelected}
                    aria-label="Select all backtests"
                    className=""
                  />
                ) : null}
              </th>
              <SortTh
                label="Contract"
                active={table.sortKey === "contract"}
                dir={table.sortDir}
                onSort={() => table.onSort("contract")}
              />
              <SortTh
                label="Name"
                active={table.sortKey === "name"}
                dir={table.sortDir}
                onSort={() => table.onSort("name")}
              />
              <SortTh
                label="Desk Type"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "type"}
                dir={table.sortDir}
                onSort={() => table.onSort("type")}
              />
              <SortTh
                label="Template"
                active={table.sortKey === "template"}
                dir={table.sortDir}
                onSort={() => table.onSort("template")}
              />
              <SortTh
                label="Days"
                active={table.sortKey === "days"}
                dir={table.sortDir}
                onSort={() => table.onSort("days")}
              />
              <SortTh
                label="Win Rate"
                active={table.sortKey === "win"}
                dir={table.sortDir}
                onSort={() => table.onSort("win")}
              />
              <SortTh
                label="ROE"
                active={table.sortKey === "roe"}
                dir={table.sortDir}
                onSort={() => table.onSort("roe")}
              />
              <SortTh
                label="APR"
                active={table.sortKey === "apr"}
                dir={table.sortDir}
                onSort={() => table.onSort("apr")}
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
            {listRows.length === 0 ? (
              <tr>
                <td
                  colSpan={BACKTEST_RUN_COLUMNS}
                  className="px-4 py-6 text-sm text-ink-muted"
                >
                  {filtersActive
                    ? "No backtests match these filters."
                    : empty}
                </td>
              </tr>
            ) : (
              pageEntries.map((entry) => {
                const childBadgeSummary =
                  entry.role == null
                    ? savedBacktestChildBadge(
                        familyByHead.get(entry.run.id)?.children ?? [],
                      )
                    : null;
                return (
                  <BacktestRunRow
                    key={entry.run.id}
                    row={entry.run}
                    memberId={memberId}
                    isAdmin={isAdmin}
                    isPrimary={entry.run.id === primaryRunId}
                    primaryBadge={primaryBadge}
                    childBadge={childBadge}
                    childRole={entry.role}
                    childSummary={childBadgeSummary}
                    familyExpanded={
                      childBadgeSummary
                        ? !collapsedFamilies.has(entry.run.id)
                        : null
                    }
                    onToggleFamily={
                      childBadgeSummary
                        ? () => toggleFamily(entry.run.id)
                        : undefined
                    }
                    titleMode={titleMode}
                    templateName={attachedTemplateLabel(entry.run, templates)}
                    templateHref={attachedTemplateHref(entry.run, templates)}
                    returnTo={returnTo}
                    selected={selected.has(entry.run.id)}
                    onToggle={() => toggleRow(entry.run.id)}
                    onReplay={(runId, anchor, event) => {
                      const denial = gate ? replayClickDenial(gate) : null;
                      if (denial) {
                        event.preventDefault();
                        clickGate.show(denial, anchor);
                        return;
                      }
                      clickGate.hide();
                    }}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function backtestBaseCoin(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper.endsWith("USDT") || upper.endsWith("USDC")) {
    return upper.slice(0, -4) || upper;
  }
  return upper;
}

function BacktestContractCell({ symbol }: { symbol: string }) {
  const pair = symbol.trim();
  if (!pair) {
    return <span className="text-ink-faint">—</span>;
  }
  const baseCoin = backtestBaseCoin(pair);
  return (
    <span className="flex items-start gap-2">
      <TokenIcon symbol={baseCoin} />
      <span className="min-w-0">
        <span className="block font-medium text-ink">{baseCoin}</span>
        <span className="mt-0.5 block truncate text-hint text-ink-muted">
          {pair}
        </span>
      </span>
    </span>
  );
}

function BacktestRunRow({
  row,
  memberId,
  isAdmin,
  isPrimary,
  primaryBadge,
  childBadge,
  childRole,
  childSummary,
  familyExpanded,
  onToggleFamily,
  titleMode,
  templateName,
  templateHref,
  returnTo,
  selected,
  onToggle,
  onReplay,
}: {
  row: BacktestRun;
  memberId: string;
  isAdmin: boolean;
  isPrimary: boolean;
  primaryBadge: string;
  childBadge?: string;
  childRole: SavedBacktestChildRole | null;
  childSummary: { total: number; label: string } | null;
  /** Null when this row has no children. */
  familyExpanded: boolean | null;
  onToggleFamily?: () => void;
  titleMode: "family" | "recipe";
  templateName: string | null;
  templateHref: string | null;
  returnTo: string;
  selected: boolean;
  onToggle: () => void;
  onReplay?: (
    runId: string,
    anchor: HTMLElement,
    event: { preventDefault: () => void },
  ) => void;
}) {
  const href =
    row.status === "draft"
      ? backtestNewHref({
          draft: row.id,
          venue: row.venue,
          env: row.venueEnvironment,
        })
      : `/account/backtests/${row.id}`;
  const childHint = useActionHint();
  const title = backtestListTitle(row, titleMode);
  const days = backtestWindowDays(row.fromMs, row.toMs);
  const canRemove = canDeleteBacktestRun(row, memberId, isAdmin);
  const winRate =
    row.stats && row.stats.trades > 0
      ? `${Math.round(row.stats.winRate * 100)}%`
      : "—";
  const roe = row.stats
    ? backtestRoePct(row.stats.realizedUsdt, row.orders, row.leverage)
    : null;
  const apr = row.stats
    ? backtestAprPct(
        row.stats.realizedUsdt,
        row.stats.startingUsdt,
        row.fromMs,
        row.toMs,
      )
    : null;
  const childLabel =
    childRole === "comparable"
      ? "Comparable"
      : childRole === "variation"
        ? "Variation"
        : null;
  return (
    <tr
      className={`border-b border-line last:border-b-0 ${
        childRole ? "bg-canvas" : ""
      }`}
    >
      <td className="px-4 py-3">
        {canRemove ? (
          <AppCheck
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${title}`}
            className=""
          />
        ) : null}
      </td>
      <td className="px-4 py-3 align-top">
        <BacktestContractCell symbol={row.symbol} />
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`inline-flex flex-wrap items-center gap-2 ${
            childRole ? "pl-4" : ""
          }`}
        >
          {familyExpanded != null ? (
            <button
              type="button"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
              aria-expanded={familyExpanded}
              aria-label={
                familyExpanded
                  ? `Hide children of ${title}`
                  : `Show children of ${title}`
              }
              onClick={onToggleFamily}
            >
              {familyExpanded ? (
                <IconChevronDown className="size-3.5" />
              ) : (
                <IconChevronRight className="size-3.5" />
              )}
            </button>
          ) : null}
          {childSummary ? (
            <>
              <button
                type="button"
                className="rounded-control bg-surface-raised px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ink-muted hover:text-ink"
                aria-expanded={familyExpanded ?? undefined}
                aria-label={`${childSummary.label}. ${
                  familyExpanded
                    ? `Hide children of ${title}`
                    : `Show children of ${title}`
                }`}
                onClick={onToggleFamily}
                {...childHint.tip}
              >
                {childSummary.total}
              </button>
              <TableHint box={childHint.box} label={childSummary.label} detail="" />
            </>
          ) : null}
          {childRole ? (
            <IconCornerDownRight className="size-3.5 shrink-0 text-ink-faint" />
          ) : null}
          <span className="inline-flex min-w-0 items-center gap-1">
            <Link href={href} className="text-ink hover:underline">
              {title}
            </Link>
            <TemplateParametersButton name={title} recipe={row.recipe} />
          </span>
          {childLabel ? (
            <span className="rounded-control bg-surface-raised px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
              {childLabel}
            </span>
          ) : isPrimary ? (
            <span className="rounded-control bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
              {primaryBadge}
            </span>
          ) : childBadge ? (
            <span className="rounded-control bg-surface-raised px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
              {childBadge}
            </span>
          ) : null}
          {backtestRunWasLiquidated(row.orders) ? (
            <span className="rounded-control bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">
              Liq
            </span>
          ) : null}
          {row.userId == null ? (
            <span className="text-hint text-ink-faint">published</span>
          ) : null}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-ink-muted">
        {row.deskType === "dca" ? "DCA" : "Flex"}
      </td>
      <td className="px-4 py-3">
        {templateName && templateHref ? (
          <Link href={templateHref} className="text-ink hover:underline">
            {templateName}
          </Link>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {days != null ? formatCount(days) : "—"}
      </td>
      <td className="px-4 py-3 tabular-nums">{winRate}</td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(roe)}`}>
        {formatBacktestReturnPct(roe)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(apr)}`}>
        {formatBacktestReturnPct(apr)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge label={statusLabel(row.status)} status={row.status} />
      </td>
      <td className={TABLE_ACTIONS_TD_CLASS}>
        <TableActions>
          {row.status === "done" ? (
            <TableIconAction
              href={`/account/backtests/${row.id}/replay`}
              target="_blank"
              rel="noreferrer"
              prefetch={false}
              label="Replay"
              detail="Open this run on the replay page in a new tab."
              onClick={(event) =>
                onReplay?.(row.id, event.currentTarget, event)
              }
            >
              <IconPlay
                {...TABLE_BTN_ICON}
                className="size-3.5 shrink-0 fill-current"
              />
            </TableIconAction>
          ) : null}
          {row.parentRunId ? (
            <DetachBacktestButton runId={row.id} canDetach={canRemove} />
          ) : null}
          <RemoveBacktestButton
            runId={row.id}
            canRemove={canRemove}
            returnTo={returnTo}
          />
        </TableActions>
      </td>
    </tr>
  );
}
