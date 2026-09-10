"use client";

import { useEffect, useRef, useState } from "react";
import { useConfirmDialog } from "@/components/confirm-modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RemoveBacktestButton } from "@/components/backtest-run-view";
import { deleteBacktestRunsAction } from "@/lib/backtest/actions";
import {
  backtestAprPct,
  backtestRoePct,
  backtestRunTitle,
  backtestRunWasLiquidated,
  backtestSavedListHref,
  backtestWindowDays,
  canDeleteBacktestRun,
  formatBacktestReturnPct,
  type BacktestRun,
} from "@/lib/backtest/model";
import { formatCount, signedTone } from "@/lib/opportunities/format";

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const secondaryBtn =
  "rounded-control border border-line px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-50";
const dangerBtn =
  "rounded-control border border-line px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-50";

export function BacktestRunsTable({
  runs,
  memberId,
  isAdmin,
  primaryRunId,
  returnTo = "/account/backtests",
  watchRunId,
}: {
  runs: BacktestRun[];
  memberId: string;
  isAdmin: boolean;
  primaryRunId?: string;
  returnTo?: string;
  watchRunId?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirmDialog();
  const removableIds = runs
    .filter((row) => canDeleteBacktestRun(row, memberId, isAdmin))
    .map((row) => row.id);
  const allSelected =
    removableIds.length > 0 && removableIds.every((id) => selected.has(id));
  const selectedCount = selected.size;

  useEffect(() => {
    const known = new Set(removableIds);
    setSelected((current) => {
      const next = new Set([...current].filter((id) => known.has(id)));
      if (next.size === current.size && [...next].every((id) => current.has(id))) {
        return current;
      }
      return next;
    });
  }, [removableIds.join("|")]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedCount > 0 && !allSelected;
    }
  }, [allSelected, selectedCount]);

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
    setSelected(allSelected ? new Set() : new Set(removableIds));
  }

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
      data.append("runId", id);
    }
    const result = await deleteBacktestRunsAction(data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not remove those backtests.");
      return;
    }
    const deletedCurrent = Boolean(watchRunId && selected.has(watchRunId));
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
    <div className="space-y-3">
      {dialog}
      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-ink-muted">{selectedCount} selected</p>
          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={pending}
            className={dangerBtn}
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className={secondaryBtn}
          >
            Clear
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint [&_th]:whitespace-nowrap">
            <tr>
              <th className="w-10 px-4 py-3">
                {removableIds.length > 0 ? (
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all backtests"
                    className="size-4"
                  />
                ) : null}
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Contract</th>
              <th className="px-4 py-3 font-medium">Comps</th>
              <th className="px-4 py-3 font-medium">Days</th>
              <th className="px-4 py-3 font-medium">Win Rate</th>
              <th className="px-4 py-3 font-medium">ROE</th>
              <th className="px-4 py-3 font-medium">APR</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((row) => (
              <BacktestRunRow
                key={row.id}
                row={row}
                memberId={memberId}
                isAdmin={isAdmin}
                isPrimary={row.id === primaryRunId}
                returnTo={returnTo}
                selected={selected.has(row.id)}
                onToggle={() => toggleRow(row.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BacktestRunRow({
  row,
  memberId,
  isAdmin,
  isPrimary,
  returnTo,
  selected,
  onToggle,
}: {
  row: BacktestRun;
  memberId: string;
  isAdmin: boolean;
  isPrimary: boolean;
  returnTo: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const href = `/account/backtests/${row.id}`;
  const title = backtestRunTitle(row);
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
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-3">
        {canRemove ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${title}`}
            className="size-4"
          />
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex flex-wrap items-center gap-2">
          <Link href={href} className="text-accent hover:underline">
            {title}
          </Link>
          {isPrimary ? (
            <span className="rounded-control bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
              Primary Pair
            </span>
          ) : null}
          {backtestRunWasLiquidated(row.orders) ? (
            <span className="rounded-control bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">
              Liq
            </span>
          ) : null}
          {row.userId == null ? (
            <span className="text-xs text-ink-faint">published</span>
          ) : null}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {row.deskType === "dca" ? "DCA" : "Perps"}
      </td>
      <td className="px-4 py-3 font-medium tabular-nums">{row.symbol}</td>
      <td className="px-4 py-3 text-ink-muted">
        {(row.comparableSymbols ?? []).length > 0
          ? `+${row.comparableSymbols.length}`
          : "—"}
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
      <td className="px-4 py-3">{statusLabel(row.status)}</td>
      <td className="px-4 py-3">
        <RemoveBacktestButton
          runId={row.id}
          canRemove={canRemove}
          returnTo={returnTo}
          compact
        />
      </td>
    </tr>
  );
}
