"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DeskChart } from "@/components/desk-chart";
import { Modal } from "@/components/template-modals";
import {
  attachBacktestToTemplateAction,
  deleteBacktestAction,
  publishBacktestAction,
  saveBacktestAsTemplateAction,
} from "@/lib/backtest/actions";
import { applyTemplateAction } from "@/lib/templates/actions";
import {
  chartIntervalForWindow,
  formatBacktestReturnPct,
  peakLockedNotionalUsdt,
  realizedAprPct,
  realizedEndingUsdt,
  realizedReturnPct,
  returnOnCapitalUsedPct,
  splitCompletedBacktestOrders,
  type BacktestRun,
} from "@/lib/backtest/model";
import {
  buildBacktestChartOverlay,
  snapOverlayToCandles,
} from "@/lib/charts/overlay";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import type { CandleBar } from "@/lib/market/candles";

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
  const usedPct = returnOnCapitalUsedPct(stats.realizedUsdt, peakUsed);
  const apr = realizedAprPct(
    stats.realizedUsdt,
    peakUsed,
    run.fromMs,
    run.toMs,
  );
  return (
    <BacktestPropertyList
      rows={[
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
        { label: "Trades", value: String(stats.trades) },
        { label: "Win rate", value: pct(stats.winRate) },
        {
          label: "Realized P&L",
          value: money(stats.realizedUsdt),
          hint: "Closed trades after fees",
        },
        { label: "Max drawdown", value: money(stats.maxDrawdownUsdt) },
        {
          label: "Account return",
          value: formatBacktestReturnPct(realizedReturn),
          hint: `${money(stats.realizedUsdt)} on ${money(stats.startingUsdt)} starting`,
        },
        {
          label: "On capital used",
          value: formatBacktestReturnPct(usedPct),
          hint:
            peakUsed > 0
              ? `${money(stats.realizedUsdt)} on ${money(peakUsed)} peak position`
              : "No position was opened",
        },
        {
          label: "APR",
          value: formatBacktestReturnPct(apr),
          hint: "On max capital used, compounded over the window",
        },
        {
          label: "Max capital used",
          value: peakUsed > 0 ? money(peakUsed) : "—",
          hint: "Peak locked notional (qty × entry) while a position was open",
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
  rows: Array<{ label: string; value: string; hint?: string }>;
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
          <dd className="min-w-0 text-right text-sm font-medium tabular-nums">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const TRADE_PAGE_SIZE = 15;

export function BacktestOrdersTable({ run }: { run: BacktestRun }) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [run.id]);
  const { open } = splitCompletedBacktestOrders(run.orders);
  const openSet = new Set(open);
  const fills = run.orders;
  if (fills.length === 0) {
    return <p className="text-sm text-ink-muted">No simulated fills.</p>;
  }
  const pageCount = Math.max(1, Math.ceil(fills.length / TRADE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * TRADE_PAGE_SIZE;
  const rows = fills.slice(start, start + TRADE_PAGE_SIZE);
  const from = start + 1;
  const to = start + rows.length;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Time</th>
              <th className="py-1.5 pr-3 font-medium">Action</th>
              <th className="py-1.5 pr-3 font-medium">Side</th>
              <th className="py-1.5 pr-3 font-medium">Qty</th>
              <th className="py-1.5 pr-3 font-medium">Price</th>
              <th className="py-1.5 pr-3 font-medium">Fee</th>
              <th className="py-1.5 font-medium">Realized</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const current = openSet.has(row);
              return (
                <tr
                  key={`${row.atMs}-${start + index}`}
                  className="border-t border-line"
                >
                  <td className="py-1.5 pr-3 text-ink-muted">
                    {new Date(row.atMs).toLocaleString("en-AU")}
                  </td>
                  <td className="py-1.5 pr-3">
                    {current
                      ? "open"
                      : row.action === "flatten"
                        ? "Close"
                        : row.action}
                  </td>
                  <td className="py-1.5 pr-3">{row.side}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{row.qty}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{money(row.price)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {money(row.feeUsdt)}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {current
                      ? "—"
                      : row.realizedUsdt == null
                        ? "—"
                        : money(row.realizedUsdt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <p>
          {from}–{to} of {fills.length}
        </p>
        {pageCount > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="rounded-control border border-line px-2 py-1 text-ink hover:border-line-strong disabled:opacity-40"
            >
              Previous
            </button>
            <p>
              {safePage + 1} / {pageCount}
            </p>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
              className="rounded-control border border-line px-2 py-1 text-ink hover:border-line-strong disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BacktestInlineChart({ run }: { run: BacktestRun }) {
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const interval = chartIntervalForWindow(run.fromMs, run.toMs, run.interval);
    const params = new URLSearchParams({
      venue: run.venue,
      symbol: run.symbol,
      interval,
      from: String(run.fromMs),
      to: String(run.toMs),
      limit: "1500",
    });
    if (run.venueEnvironment) {
      params.set("env", run.venueEnvironment);
    }
    void fetch(`/api/market/candles?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          candles?: CandleBar[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || "Could not read candles.");
        }
        return body.candles ?? [];
      })
      .then((rows) => {
        if (!cancelled) {
          setCandles(rows);
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
  }, [run]);

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading candles…</p>;
  }
  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }
  if (candles.length === 0) {
    return <p className="text-sm text-ink-muted">No candles in that window.</p>;
  }
  return (
    <DeskChart
      candles={candles}
      overlay={snapOverlayToCandles(
        buildBacktestChartOverlay({
          triggerPrice:
            run.recipe.kind === "perps" ? Number(run.recipe.triggerPrice) : null,
          orders: run.orders,
        }),
        candles,
      )}
    />
  );
}

export function BacktestChartButton({ run }: { run: BacktestRun }) {
  const [open, setOpen] = useState(false);
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const interval = chartIntervalForWindow(run.fromMs, run.toMs, run.interval);
    const params = new URLSearchParams({
      venue: run.venue,
      symbol: run.symbol,
      interval,
      from: String(run.fromMs),
      to: String(run.toMs),
      limit: "1500",
    });
    if (run.venueEnvironment) {
      params.set("env", run.venueEnvironment);
    }
    void fetch(`/api/market/candles?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          candles?: CandleBar[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || "Could not read candles.");
        }
        return body.candles ?? [];
      })
      .then((rows) => {
        if (!cancelled) {
          setCandles(rows);
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
  }, [open, run]);

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
          title={`${run.symbol} · ${DCA_INDICATOR_TIMEFRAME_LABELS[run.interval]}`}
          onClose={() => setOpen(false)}
          wide
        >
          {loading ? (
            <p className="mt-3 text-sm text-ink-muted">Loading candles…</p>
          ) : error ? (
            <p className="mt-3 text-sm text-danger">{error}</p>
          ) : (
            <div className="mt-3">
              <DeskChart
                candles={candles}
                overlay={snapOverlayToCandles(
                  buildBacktestChartOverlay({
                    triggerPrice:
                      run.recipe.kind === "perps"
                        ? Number(run.recipe.triggerPrice)
                        : null,
                    orders: run.orders,
                  }),
                  candles,
                )}
              />
            </div>
          )}
        </Modal>
      ) : null}
    </>
  );
}

export function AttachBacktestButton({
  runId,
  sourceName,
}: {
  runId: string;
  sourceName: string | null;
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
      <button
        type="submit"
        disabled={pending}
        className="rounded-control border border-line px-3 py-1.5 text-sm text-ink hover:border-line-strong disabled:opacity-50"
      >
        {pending
          ? "Attaching…"
          : sourceName
            ? `Attach results to ${sourceName}`
            : "Attach results"}
      </button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}

export function SaveBacktestAsTemplateButton({
  runId,
  defaultName,
}: {
  runId: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex items-center gap-2"
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await saveBacktestAsTemplateAction(formData);
        setPending(false);
        if (!result.ok) {
          setError(result.error ?? "Could not save that template.");
          return;
        }
        router.refresh();
      }}
    >
      <input type="hidden" name="runId" value={runId} />
      <input
        name="name"
        defaultValue={defaultName}
        className="w-40 rounded-control border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-control border border-line px-3 py-1.5 text-sm text-ink hover:border-line-strong disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save as template"}
      </button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}

export function ApplyBacktestButton({
  templateId,
  desks,
}: {
  templateId: string | null;
  desks: Array<{ id: string; name: string }>;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!templateId || desks.length === 0) {
    return null;
  }
  return (
    <form
      className="flex items-center gap-2"
      action={async (formData) => {
        setPending(true);
        setMessage(null);
        const result = await applyTemplateAction(formData);
        setPending(false);
        setMessage(
          result.ok
            ? (result.notes?.[0] ?? "Applied idle on that desk.")
            : (result.error ?? "Could not apply."),
        );
      }}
    >
      <input type="hidden" name="templateId" value={templateId} />
      <select
        name="accountId"
        className="rounded-control border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
      >
        {desks.map((desk) => (
          <option key={desk.id} value={desk.id}>
            {desk.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-control border border-line px-3 py-1.5 text-sm text-ink hover:border-line-strong disabled:opacity-50"
      >
        {pending ? "Applying…" : "Apply idle"}
      </button>
      {message ? <p className="text-xs text-ink-muted">{message}</p> : null}
    </form>
  );
}

export function PublishBacktestButton({
  runId,
  canPublish,
}: {
  runId: string;
  canPublish: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canPublish) {
    return null;
  }
  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await publishBacktestAction(formData);
        setPending(false);
        if (!result.ok) {
          setError(result.error ?? "Could not publish.");
        }
      }}
    >
      <input type="hidden" name="runId" value={runId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-control border border-line px-3 py-1.5 text-sm text-ink hover:border-line-strong disabled:opacity-50"
      >
        {pending ? "Publishing…" : "Publish"}
      </button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}

export function RemoveBacktestButton({
  runId,
  canRemove,
  returnTo = "/account/backtests",
  compact = false,
}: {
  runId: string;
  canRemove: boolean;
  returnTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canRemove) {
    return null;
  }
  return (
    <form
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
      <button
        type="submit"
        disabled={pending}
        className={
          compact
            ? "rounded-control px-2 py-0.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
            : "rounded-control border border-line px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
        }
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}
