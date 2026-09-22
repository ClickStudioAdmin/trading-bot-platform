"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconFilterClear, IconPlus, IconTemplates, IconTrash } from "@/components/icons";
import { BotButtonLead, botBtnIcon } from "@/components/bot-form-chrome";
import {
  SortTh,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableCard,
  TableFilterBar,
  TableFilterField,
  TableFilterSession,
  TableIconAction,
  TableLabelButton,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import { AppCheck } from "@/components/app-check";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";
import { useRouter } from "next/navigation";
import { nudgeBacktestRunAction } from "@/lib/backtest/actions";

const BACKTEST_REFRESH_MS = 5_000;

export function BacktestRunRefresh({
  active,
  runId,
}: {
  active: boolean;
  runId: string;
}) {
  const router = useRouter();
  const nudgedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!active || nudgedFor.current === runId) {
      return;
    }
    nudgedFor.current = runId;
    void nudgeBacktestRunAction(runId).finally(() => {
      router.refresh();
    });
  }, [active, runId, router]);

  useEffect(() => {
    if (!active) {
      return;
    }
    let timer = 0;

    function refresh() {
      if (document.hidden) {
        return;
      }
      router.refresh();
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    }

    function start() {
      stop();
      if (document.hidden) {
        return;
      }
      timer = window.setInterval(refresh, BACKTEST_REFRESH_MS);
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
        return;
      }
      refresh();
      start();
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, router]);

  return null;
}
import { DeskChart } from "@/components/desk-chart";
import {
  Modal,
  StarterPackCheckbox,
  saveFolderGroups,
} from "@/components/template-modals";
import type { AutomationTemplateSet } from "@/lib/templates/store";
import type { TemplateDeskType } from "@/lib/templates/recipe";
import {
  applyBacktestToDeskAction,
  attachBacktestToTemplateAction,
  deleteBacktestAction,
  saveBacktestAsPlatformTemplateAction,
  saveBacktestAsTemplateAction,
} from "@/lib/backtest/actions";
import {
  backtestChartFetchBounds,
  backtestMarginUsdt,
  backtestOutcomeLabel,
  backtestRunOutcome,
  chartIntervalForWindow,
  formatBacktestReturnPct,
  peakLockedNotionalUsdt,
  realizedEndingUsdt,
  realizedReturnPct,
  splitCompletedBacktestOrders,
  type BacktestRun,
  type SimulatedOrder,
} from "@/lib/backtest/model";
import { loadBacktestDisplayCandles } from "@/lib/charts/load-backtest-candles";
import {
  backtestChartLevels,
  backtestCycleSpanMs,
  listBacktestCycles,
} from "@/lib/backtest/positions";
import {
  backtestChartIncludeAdds,
  buildBacktestChartOverlay,
  candleRangeForFocus,
  snapOverlayToCandles,
} from "@/lib/charts/overlay";
import { BacktestChartIntervalBar } from "@/components/backtest-chart-interval";
import { formatLocalDate } from "@/lib/time/display";
import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { clipCandlesToWindow, type CandleBar } from "@/lib/market/candles";
import { formatQty, signedTone } from "@/lib/opportunities/format";
import { AppMultiSelect, AppSelect } from "@/components/app-select";

function backtestChartWindow(
  run: BacktestRun,
  interval: DcaIndicatorTimeframe,
) {
  return {
    interval,
    bounds: backtestChartFetchBounds(run, interval),
  };
}

function candlesForBacktestChart(
  candles: CandleBar[],
  run: BacktestRun,
  interval: DcaIndicatorTimeframe,
): CandleBar[] {
  const { bounds } = backtestChartWindow(run, interval);
  return clipCandlesToWindow(candles, bounds.fromMs, bounds.toMs);
}

function money(value: number): string {
  const abs = Math.abs(value);
  const text = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-$${text}` : `$${text}`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function BacktestStatsGrid({ run }: { run: BacktestRun }) {
  const stats = run.stats;
  if (!stats) {
    return (
      <p className="text-sm text-ink-muted">
        {run.error ?? "This run has no stats yet."}
      </p>
    );
  }
  const ending = realizedEndingUsdt(stats);
  const realizedReturn = realizedReturnPct(stats);
  const peakUsed = peakLockedNotionalUsdt(run.orders);
  const peakMargin = backtestMarginUsdt(peakUsed, run.leverage);
  const outcome = backtestRunOutcome({
    orders: run.orders,
    realizedUsdt: stats.realizedUsdt,
  });
  return (
    <BacktestPropertyList
      rows={[
        {
          label: "Outcome",
          value: backtestOutcomeLabel(outcome),
          hint:
            outcome === "liquidated"
              ? "Marked equity hit $0. Open positions flattened and the replay stopped."
              : "Sign of realized P&L on the starting balance.",
          toneClass:
            outcome === "profit"
              ? "text-success"
              : "text-danger",
        },
        {
          label: "Starting",
          value: money(stats.startingUsdt),
          hint: "Paper account at the window start",
        },
        {
          label: "Ending",
          value: money(ending),
          hint: "Starting + realized. Open mark is in Current trades.",
        },
        {
          label: "Account return",
          value: formatBacktestReturnPct(realizedReturn),
          hint: `${money(stats.realizedUsdt)} on ${money(stats.startingUsdt)} starting`,
        },
        {
          label: "Leverage",
          value: `${run.leverage}×`,
          hint: "Replay cash and ROE use this. Margin = position value ÷ leverage.",
        },
        {
          label: "Max capital used",
          value: peakUsed > 0 ? money(peakUsed) : "—",
          hint: "Peak locked notional (qty × entry) while a position was open",
        },
        {
          label: "Max margin used",
          value: peakUsed > 0 ? money(peakMargin) : "—",
          hint: "Peak position value ÷ leverage",
        },
        {
          label: "Profit factor",
          value:
            stats.profitFactor == null ? "—" : stats.profitFactor.toFixed(2),
        },
        { label: "Time in market", value: pct(stats.timeInMarket) },
      ]}
    />
  );
}

export function BacktestCurrentTrades({ run }: { run: BacktestRun }) {
  const stats = run.stats;
  if (!stats) {
    return (
      <p className="text-sm text-ink-muted">No open position on this run.</p>
    );
  }
  return (
    <BacktestPropertyList
      rows={[
        {
          label: "Open",
          value: stats.openSide
            ? `${stats.openSide} ${stats.openQty.toFixed(4)}`
            : "Flat",
        },
        {
          label: "Unrealized",
          value: money(stats.markUsdt),
          hint: "Open mark versus entry",
        },
      ]}
    />
  );
}

export function BacktestPropertyList({
  rows,
}: {
  rows: Array<{
    label: string;
    value: string;
    hint?: string;
    toneClass?: string;
  }>;
}) {
  return (
    <dl className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 px-5 py-2.5"
          title={row.hint}
        >
          <dt className="shrink-0 text-xs uppercase tracking-[0.12em] text-ink-muted">
            {row.label}
          </dt>
          <dd
            className={`min-w-0 text-right text-sm font-medium tabular-nums ${
              row.toneClass ?? ""
            }`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function fillActionLabel(
  row: SimulatedOrder,
  current: boolean,
): string {
  if (current) {
    return "Open";
  }
  if (row.action === "flatten") {
    return "Close";
  }
  if (row.action === "buy") {
    return "Buy";
  }
  if (row.action === "sell") {
    return "Sell";
  }
  return row.action;
}

type FillActionFilter = "" | "open" | "close" | "buy" | "sell";

function fillHaystack(
  row: SimulatedOrder,
  current: boolean,
): string {
  return [
    fillActionLabel(row, current),
    row.side,
    row.action,
    row.reason ?? "",
    String(row.qty),
    String(row.price),
  ]
    .join(" ")
    .toLowerCase();
}

export function BacktestOrdersTable({ run }: { run: BacktestRun }) {
  const { open } = splitCompletedBacktestOrders(run.orders);
  const openSet = useMemo(() => new Set(open), [open]);
  const fills = run.orders;
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<FillActionFilter>("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return fills.filter((row) => {
      const current = openSet.has(row);
      const label = fillActionLabel(row, current).toLowerCase();
      if (action && label !== action) {
        return false;
      }
      return !needle || fillHaystack(row, current).includes(needle);
    });
  }, [action, fills, openSet, query]);
  const compare = useCallback(
    (left: SimulatedOrder, right: SimulatedOrder, key: string, dir: TableSortDir) => {
      if (key === "time") {
        return compareTableNum(left.atMs, right.atMs, dir);
      }
      if (key === "action") {
        return compareTableText(
          fillActionLabel(left, openSet.has(left)),
          fillActionLabel(right, openSet.has(right)),
          dir,
        );
      }
      if (key === "side") {
        return compareTableText(left.side, right.side, dir);
      }
      if (key === "qty") {
        return compareTableNum(left.qty, right.qty, dir);
      }
      if (key === "price") {
        return compareTableNum(left.price, right.price, dir);
      }
      if (key === "fee") {
        return compareTableNum(left.feeUsdt, right.feeUsdt, dir);
      }
      if (key === "realized") {
        const leftVal = openSet.has(left) ? null : left.realizedUsdt;
        const rightVal = openSet.has(right) ? null : right.realizedUsdt;
        if (leftVal === null && rightVal === null) {
          return 0;
        }
        if (leftVal === null) {
          return 1;
        }
        if (rightVal === null) {
          return -1;
        }
        return compareTableNum(leftVal, rightVal, dir);
      }
      return 0;
    },
    [openSet],
  );
  const table = useClientTable(filtered, compare, { defaultKey: "time" });
  if (fills.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
        No simulated fills.
      </p>
    );
  }
  return (
    <div>
      <TableFilterSession>
          <TableFilterBar className="mb-4">
            <TableFilterField label="Search">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  table.setPage(1);
                }}
                placeholder="Action or side"
                autoComplete="off"
                className={TABLE_FILTER_FIELD_CLASS}
              />
            </TableFilterField>
            <TableFilterField label="Action">
              <AppSelect
                value={action}
                onChange={(event) => {
                  setAction(event.target.value as FillActionFilter);
                  table.setPage(1);
                }}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="close">Close</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </AppSelect>
            </TableFilterField>
            <TableLabelButton
              variant="filter"
              icon={<IconFilterClear {...TABLE_BTN_ICON} />}
              onClick={() => {
                setQuery("");
                setAction("");
                table.setPage(1);
              }}
            >
              Clear
            </TableLabelButton>
          </TableFilterBar>
      </TableFilterSession>
      <TableCard
        pager={
          <TablePager
            window={table.window}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
          />
        }
      >
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <SortTh
                label="Time"
                active={table.sortKey === "time"}
                dir={table.sortDir}
                onSort={() => table.onSort("time")}
              />
              <SortTh
                label="Action"
                active={table.sortKey === "action"}
                dir={table.sortDir}
                onSort={() => table.onSort("action")}
              />
              <SortTh
                label="Side"
                active={table.sortKey === "side"}
                dir={table.sortDir}
                onSort={() => table.onSort("side")}
              />
              <SortTh
                label="Qty"
                active={table.sortKey === "qty"}
                dir={table.sortDir}
                onSort={() => table.onSort("qty")}
              />
              <SortTh
                label="Price"
                active={table.sortKey === "price"}
                dir={table.sortDir}
                onSort={() => table.onSort("price")}
              />
              <SortTh
                label="Fee"
                active={table.sortKey === "fee"}
                dir={table.sortDir}
                onSort={() => table.onSort("fee")}
              />
              <SortTh
                label="Realized"
                active={table.sortKey === "realized"}
                dir={table.sortDir}
                onSort={() => table.onSort("realized")}
              />
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-ink-muted">
                  No fills match.
                </td>
              </tr>
            ) : (
              table.pageRows.map((row, index) => {
              const current = openSet.has(row);
              const realized = current ? null : row.realizedUsdt;
              return (
                <tr
                  key={`${row.atMs}-${table.window.start + index}`}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                    {new Date(row.atMs).toLocaleString("en-AU")}
                  </td>
                  <td className="px-4 py-3">{fillActionLabel(row, current)}</td>
                  <td className="px-4 py-3 capitalize">{row.side}</td>
                  <td
                    className="px-4 py-3 tabular-nums"
                    title={String(row.qty)}
                  >
                    {formatQty(row.qty)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{money(row.price)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {money(row.feeUsdt)}
                  </td>
                  <td className={`px-4 py-3 tabular-nums ${signedTone(realized)}`}>
                    {realized == null ? "—" : money(realized)}
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function backtestOverlayForRun(
  run: BacktestRun,
  extra?: { focusCycleId?: string | null; includeAdds?: boolean },
) {
  return buildBacktestChartOverlay({
    triggerPrice:
      run.recipe.kind === "perps" ? Number(run.recipe.triggerPrice) : null,
    orders: run.orders,
    focusCycleId: extra?.focusCycleId,
    includeAdds: extra?.includeAdds,
    levels: backtestChartLevels(run.recipe, run.orders, extra?.focusCycleId),
  });
}

function BacktestTradeStepper({
  cycles,
  focusCycleId,
  onFocusCycleId,
  onShowAll,
}: {
  cycles: ReturnType<typeof listBacktestCycles>;
  focusCycleId: string | null;
  onFocusCycleId: (id: string | null) => void;
  onShowAll: () => void;
}) {
  if (cycles.length === 0) {
    return null;
  }
  const index = focusCycleId
    ? cycles.findIndex((row) => row.id === focusCycleId)
    : -1;
  const current = index >= 0 ? cycles[index] : null;
  const step =
    "rounded-control border border-line px-2 py-1 text-xs text-ink hover:border-line-strong disabled:opacity-40";
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label="Trades on chart"
    >
      <button
        type="button"
        className={step}
        disabled={index === 0}
        onClick={() => {
          if (index < 0) {
            onFocusCycleId(cycles[cycles.length - 1]!.id);
            return;
          }
          if (index > 0) {
            onFocusCycleId(cycles[index - 1]!.id);
          }
        }}
      >
        Prev
      </button>
      <span className="min-w-0 px-1 text-xs text-ink-muted">
        {current
          ? `${index + 1} / ${cycles.length} · ${
              current.side === "short" ? "Short" : "Long"
            } · ${formatLocalDate(current.openedAtMs)}`
          : `All ${cycles.length} trades`}
      </span>
      <button
        type="button"
        className={step}
        disabled={index === cycles.length - 1}
        onClick={() => {
          if (index < 0) {
            onFocusCycleId(cycles[0]!.id);
            return;
          }
          if (index < cycles.length - 1) {
            onFocusCycleId(cycles[index + 1]!.id);
          }
        }}
      >
        Next
      </button>
      <button
        type="button"
        className={step}
        onClick={onShowAll}
      >
        All
      </button>
    </div>
  );
}

export function BacktestInlineChart({
  run,
  interval,
  onIntervalChange,
  focusCycleId = null,
  onFocusCycleId,
}: {
  run: BacktestRun;
  interval: DcaIndicatorTimeframe;
  onIntervalChange: (value: DcaIndicatorTimeframe) => void;
  focusCycleId?: string | null;
  onFocusCycleId?: (id: string | null) => void;
}) {
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewKey, setViewKey] = useState(0);
  const hadFocus = useRef(focusCycleId != null);

  useEffect(() => {
    if (hadFocus.current && focusCycleId == null) {
      setViewKey((current) => current + 1);
    }
    hadFocus.current = focusCycleId != null;
  }, [focusCycleId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const { bounds } = backtestChartWindow(run, interval);
    void loadBacktestDisplayCandles({
      venue: run.venue,
      venueEnvironment: run.venueEnvironment,
      symbol: run.symbol,
      interval,
      fromMs: bounds.fromMs,
      toMs: bounds.toMs,
    })
      .then((rows) => {
        if (!cancelled) {
          setCandles(candlesForBacktestChart(rows, run, interval));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not read candles.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [run, interval]);

  const cycles = listBacktestCycles(run.orders);
  const focused = cycles.find((row) => row.id === focusCycleId) ?? null;
  const span = focused ? backtestCycleSpanMs(focused) : null;
  const visibleRange =
    span != null ? candleRangeForFocus(candles, span.fromMs, span.toMs) : null;
  const includeAdds = focusCycleId == null;

  return (
    <DeskChart
      candles={candles}
      rightOffset={16}
      screenshotName={`${run.symbol}-backtest.png`}
      visibleRange={visibleRange}
      viewKey={viewKey}
      status={
        candles.length === 0
          ? (error ??
            (loading ? "Loading candles…" : "No candles in that window."))
          : null
      }
      toolbar={
        <BacktestChartIntervalBar
          run={run}
          interval={interval}
          onChange={onIntervalChange}
        />
      }
      toolbarCenter={
        onFocusCycleId ? (
          <BacktestTradeStepper
            cycles={cycles}
            focusCycleId={focusCycleId}
            onFocusCycleId={onFocusCycleId}
            onShowAll={() => {
              if (focusCycleId == null) {
                setViewKey((current) => current + 1);
                return;
              }
              onFocusCycleId(null);
            }}
          />
        ) : null
      }
      overlay={snapOverlayToCandles(
        backtestOverlayForRun(run, { focusCycleId, includeAdds }),
        candles,
      )}
    />
  );
}

export function BacktestChartButton({ run }: { run: BacktestRun }) {
  const [open, setOpen] = useState(false);
  const [interval, setInterval] = useState(() =>
    chartIntervalForWindow(run.fromMs, run.toMs, run.interval),
  );
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const { bounds } = backtestChartWindow(run, interval);
    void loadBacktestDisplayCandles({
      venue: run.venue,
      venueEnvironment: run.venueEnvironment,
      symbol: run.symbol,
      interval,
      fromMs: bounds.fromMs,
      toMs: bounds.toMs,
    })
      .then((rows) => {
        if (!cancelled) {
          setCandles(candlesForBacktestChart(rows, run, interval));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not read candles.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, run, interval]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoading(true);
          setError(null);
          setOpen(true);
        }}
        className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink hover:border-line-strong"
      >
        Chart
      </button>
      {open ? (
        <Modal
          title={`${run.symbol} · ${DCA_INDICATOR_TIMEFRAME_LABELS[interval]}`}
          onClose={() => setOpen(false)}
          wide
        >
          <div className="mt-3">
            <DeskChart
              candles={candles}
              rightOffset={16}
              screenshotName={`${run.symbol}-backtest.png`}
              status={
                candles.length === 0
                  ? (error ??
                    (loading
                      ? "Loading candles…"
                      : "No candles in that window."))
                  : null
              }
              toolbar={
                <BacktestChartIntervalBar
                  run={run}
                  interval={interval}
                  onChange={setInterval}
                />
              }
              overlay={snapOverlayToCandles(
                backtestOverlayForRun(run, {
                  includeAdds: backtestChartIncludeAdds(interval),
                }),
                candles,
              )}
            />
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function BacktestOriginBadges({
  templateName,
  deskLabel,
  edited = false,
}: {
  templateName: string | null;
  deskLabel: string | null;
  edited?: boolean;
}) {
  if (!templateName && !deskLabel && !edited) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {templateName ? (
        <p className="rounded-control bg-success/15 px-2 py-0.5 text-xs text-success">
          Template · {templateName}
        </p>
      ) : null}
      {deskLabel ? (
        <p className="rounded-control bg-success/15 px-2 py-0.5 text-xs text-success">
          Desk · {deskLabel}
        </p>
      ) : null}
      {edited && !templateName && !deskLabel ? (
        <p className="rounded-control bg-warning/15 px-2 py-0.5 text-xs text-warning">
          Edited
        </p>
      ) : null}
    </div>
  );
}

export function AttachBacktestButton({
  runId,
  sourceName,
  templateId = "",
}: {
  runId: string;
  sourceName: string | null;
  templateId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await attachBacktestToTemplateAction(formData);
        setPending(false);
        if (!result.ok) {
          setError(result.error ?? "Could not attach that run.");
          return;
        }
        router.refresh();
      }}
    >
      <input type="hidden" name="runId" value={runId} />
      {templateId ? (
        <input type="hidden" name="templateId" value={templateId} />
      ) : null}
      <button
        type="submit"
        disabled={pending}
        title="Link this run to the matching library template. Recipe is unchanged."
        className="w-full rounded-control bg-accent-strong px-3 py-2 text-sm font-medium text-ink hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Attaching…" : "Attach to template"}
      </button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}

const saveFieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const savePrimaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const saveSecondaryBtn =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";

export function SaveBacktestAsTemplateButton({
  runId,
  defaultName,
  deskType,
  folders = [],
  canSaveAs,
  canSaveAsPlatform,
  variant = "primary",
}: {
  runId: string;
  defaultName: string;
  deskType: TemplateDeskType;
  folders?: AutomationTemplateSet[];
  canSaveAs: boolean;
  canSaveAsPlatform: boolean;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const platformOnly = !canSaveAs && canSaveAsPlatform;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  const [platform, setPlatform] = useState(platformOnly);
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [createFolder, setCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [starterPack, setStarterPack] = useState(false);
  const folderGroups = saveFolderGroups(folders, deskType, platform);

  if (!canSaveAs && !canSaveAsPlatform) {
    return null;
  }

  function resetAndOpen() {
    setName(defaultName);
    setPlatform(platformOnly);
    setFolderIds([]);
    setCreateFolder(false);
    setNewFolderName("");
    setStarterPack(false);
    setError(null);
    setOpen(true);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    const data = new FormData();
    data.set("runId", runId);
    data.set("name", name.trim() || defaultName);
    for (const id of folderIds) {
      data.append("folderId", id);
    }
    if (createFolder && newFolderName.trim()) {
      data.set("newFolderName", newFolderName.trim());
    }
    if (platform && starterPack) {
      data.set("starterPack", "1");
    }
    const result = platform
      ? await saveBacktestAsPlatformTemplateAction(data)
      : await saveBacktestAsTemplateAction(data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save that template.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={resetAndOpen}
        title={
          platformOnly
            ? "Create an applyable platform template from this run. Does not attach the run or arm a desk."
            : "Create a private library template and attach this run"
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-accent-strong px-3 py-2 text-sm font-medium text-ink hover:bg-accent"
      >
        <BotButtonLead icon={<IconTemplates {...botBtnIcon} />}>
          {platformOnly ? "Save as platform template" : "Save as template"}
        </BotButtonLead>
      </button>
      {open ? (
        <Modal
          title={platform ? "Save as platform template" : "Save as template"}
          onClose={() => setOpen(false)}
        >
          <p className="mt-1 text-sm text-ink-muted">
            {platform
              ? "Visible to every member. Does not attach this run or arm a desk."
              : "Saved to your template library and attached to this run. Apply it later on any matching desk."}
          </p>
          <label className="mt-4 block text-sm text-ink">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              className={saveFieldClass}
            />
          </label>
          {platform ? (
            <StarterPackCheckbox
              checked={starterPack}
              onChange={setStarterPack}
            />
          ) : null}
          <div className="mt-3">
            <p className="text-sm text-ink">Add to folder</p>
            {folderGroups.length === 0 ? (
              <p className="mt-1 text-sm text-ink-faint">
                {platform
                  ? "None yet. Create one below."
                  : "None yet. Create one below or on My Folders."}
              </p>
            ) : (
              <AppMultiSelect
                className="mt-1"
                value={folderIds}
                onChange={setFolderIds}
                placeholder="Folders"
                options={folderGroups.flatMap((group) =>
                  group.rows.map((row) => ({
                    value: row.id,
                    label:
                      folderGroups.length > 1
                        ? `${row.name} · ${group.label}`
                        : row.name,
                  })),
                )}
              />
            )}
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink">
            <AppCheck
              checked={createFolder}
              onChange={(event) => setCreateFolder(event.target.checked)}
            />
            {platform ? "Create a new platform folder" : "Create a new folder"}
          </label>
          {createFolder ? (
            <label className="mt-2 block text-sm text-ink">
              Folder name
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                maxLength={80}
                className={saveFieldClass}
              />
            </label>
          ) : null}
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={saveSecondaryBtn}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={pending || (createFolder && !newFolderName.trim())}
              className={savePrimaryBtn}
            >
              {pending ? "Saving…" : "Save template"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function ApplyBacktestButton({
  runId,
  defaultName,
  desks,
}: {
  runId: string;
  defaultName: string;
  desks: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  if (desks.length === 0) {
    return null;
  }

  function resetAndOpen() {
    setName(defaultName);
    setMessage(null);
    setError(null);
    setOpen(true);
  }

  async function onAdd(formData: FormData) {
    setPending(true);
    setMessage(null);
    setError(null);
    formData.set("runId", runId);
    formData.set("name", name.trim() || defaultName);
    const result = await applyBacktestToDeskAction(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not add that bot.");
      return;
    }
    setMessage(result.notes?.[0] ?? "Copied idle on that desk.");
  }

  return (
    <>
      <button
        type="button"
        onClick={resetAndOpen}
        title="Copies the bot onto that desk idle. Does not arm."
        className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-accent-strong px-3 py-2 text-sm font-medium text-ink hover:bg-accent"
      >
        <BotButtonLead icon={<IconPlus {...botBtnIcon} />}>
          Add to desk
        </BotButtonLead>
      </button>
      {open ? (
        <Modal title="Add to desk" onClose={() => setOpen(false)}>
          <p className="mt-1 text-sm text-ink-muted">
            Copies this recipe onto the desk idle. Does not arm.
          </p>
          <form
            className="mt-4 space-y-3"
            action={(formData) => void onAdd(formData)}
          >
            <label className="block text-sm text-ink">
              Desk
              <AppSelect
                name="accountId"
                aria-label="Desk"
                className={saveFieldClass}
              >
                {desks.map((desk) => (
                  <option key={desk.id} value={desk.id}>
                    {desk.name}
                  </option>
                ))}
              </AppSelect>
            </label>
            <label className="block text-sm text-ink">
              Bot name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                className={saveFieldClass}
              />
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {message ? <p className="text-sm text-success">{message}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={saveSecondaryBtn}
              >
                {message ? "Close" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={pending || !name.trim()}
                className={savePrimaryBtn}
              >
                {pending ? (
                  "Copying…"
                ) : (
                  <BotButtonLead icon={<IconPlus {...botBtnIcon} />}>
                    Add to desk
                  </BotButtonLead>
                )}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function RemoveBacktestButton({
  runId,
  canRemove,
  returnTo = "/account/backtests",
}: {
  runId: string;
  canRemove: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canRemove) {
    return null;
  }
  return (
    <form
      className="inline-flex"
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await deleteBacktestAction(formData);
        setPending(false);
        if (!result.ok) {
          setError(result.error ?? "Could not remove that run.");
          return;
        }
        router.push(returnTo);
        router.refresh();
      }}
    >
      <input type="hidden" name="runId" value={runId} />
      <TableIconAction
        type="submit"
        danger
        disabled={pending}
        label="Remove"
        detail="Delete this backtest run."
      >
        <IconTrash {...TABLE_BTN_ICON} />
      </TableIconAction>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}
