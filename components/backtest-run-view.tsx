"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DeskChart } from "@/components/desk-chart";
import { Modal } from "@/components/template-modals";
import { deleteBacktestAction, publishBacktestAction } from "@/lib/backtest/actions";
import { applyTemplateAction } from "@/lib/templates/actions";
import type { BacktestRun } from "@/lib/backtest/model";
import { buildBacktestChartOverlay } from "@/lib/charts/overlay";
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
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Starting" value={money(stats.startingUsdt)} />
      <Stat label="Ending" value={money(stats.endingUsdt)} />
      <Stat
        label="Return"
        value={stats.returnPct == null ? "—" : pct(stats.returnPct)}
      />
      <Stat label="Realized" value={money(stats.realizedUsdt)} />
      <Stat label="Trades" value={String(stats.trades)} />
      <Stat label="Win rate" value={pct(stats.winRate)} />
      <Stat label="Max drawdown" value={money(stats.maxDrawdownUsdt)} />
      <Stat
        label="Profit factor"
        value={
          stats.profitFactor == null ? "—" : stats.profitFactor.toFixed(2)
        }
      />
      <Stat label="Time in market" value={pct(stats.timeInMarket)} />
      <Stat
        label="Open"
        value={
          stats.openSide
            ? `${stats.openSide} ${stats.openQty.toFixed(4)}`
            : "Flat"
        }
      />
      <Stat label="Unrealized" value={money(stats.markUsdt)} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <dt className="text-xs uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export function BacktestOrdersTable({ run }: { run: BacktestRun }) {
  if (run.orders.length === 0) {
    return <p className="text-sm text-ink-muted">No simulated fills.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
          <tr>
            <th className="py-2 pr-3 font-medium">Time</th>
            <th className="py-2 pr-3 font-medium">Action</th>
            <th className="py-2 pr-3 font-medium">Side</th>
            <th className="py-2 pr-3 font-medium">Qty</th>
            <th className="py-2 pr-3 font-medium">Price</th>
            <th className="py-2 pr-3 font-medium">Fee</th>
            <th className="py-2 font-medium">Realized</th>
          </tr>
        </thead>
        <tbody>
          {run.orders.map((row, index) => (
            <tr key={`${row.atMs}-${index}`} className="border-t border-line">
              <td className="py-2 pr-3 text-ink-muted">
                {new Date(row.atMs).toLocaleString()}
              </td>
              <td className="py-2 pr-3">{row.action}</td>
              <td className="py-2 pr-3">{row.side}</td>
              <td className="py-2 pr-3 tabular-nums">{row.qty}</td>
              <td className="py-2 pr-3 tabular-nums">{money(row.price)}</td>
              <td className="py-2 pr-3 tabular-nums">{money(row.feeUsdt)}</td>
              <td className="py-2 tabular-nums">
                {row.realizedUsdt == null ? "—" : money(row.realizedUsdt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    const params = new URLSearchParams({
      venue: run.venue,
      symbol: run.symbol,
      interval: run.interval,
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
                overlay={buildBacktestChartOverlay({
                  triggerPrice:
                    run.recipe.kind === "perps"
                      ? Number(run.recipe.triggerPrice)
                      : null,
                  orders: run.orders,
                })}
              />
            </div>
          )}
        </Modal>
      ) : null}
    </>
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
      className="flex flex-wrap items-center gap-2"
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
