import Link from "next/link";
import { BacktestEquityPanel } from "@/components/backtest-equity";
import {
  ApplyBacktestButton,
  AttachBacktestButton,
  BacktestCurrentTrades,
  BacktestInlineChart,
  BacktestOrdersTable,
  BacktestPropertyList,
  BacktestStatsGrid,
  PublishBacktestButton,
  RemoveBacktestButton,
  SaveBacktestAsTemplateButton,
} from "@/components/backtest-run-view";
import {
  BACKTEST_FEE_PRESETS,
  backtestRerunHref,
  formatBacktestReturnPct,
  peakLockedNotionalUsdt,
  realizedAprPct,
  realizedReturnPct,
  returnOnCapitalUsedPct,
  type BacktestRun,
} from "@/lib/backtest/model";
import { recipeParamRows } from "@/lib/backtest/study";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import { signedTone } from "@/lib/opportunities/format";
import { formatAuDateUtc } from "@/lib/time/display";

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function backtestStatusTone(status: BacktestRun["status"]): {
  label: string;
  tone: "success" | "warning" | "danger" | "faint";
  pulse: boolean;
} {
  if (status === "queued") {
    return { label: "Queued", tone: "warning", pulse: true };
  }
  if (status === "running") {
    return { label: "Running", tone: "success", pulse: true };
  }
  if (status === "done") {
    return { label: "Done", tone: "success", pulse: false };
  }
  if (status === "failed") {
    return { label: "Failed", tone: "danger", pulse: false };
  }
  if (status === "cancelled") {
    return { label: "Cancelled", tone: "faint", pulse: false };
  }
  return { label: statusLabel(status), tone: "faint", pulse: false };
}

function StatusDot({
  tone,
  pulse,
}: {
  tone: "success" | "warning" | "danger" | "faint";
  pulse: boolean;
}) {
  const fill =
    tone === "warning"
      ? "bg-warning"
      : tone === "danger"
        ? "bg-danger"
        : tone === "faint"
          ? "bg-ink-faint"
          : "bg-success";
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden>
      {pulse ? (
        <span
          className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${fill}`}
        />
      ) : null}
      <span className={`relative inline-flex size-2.5 rounded-full ${fill}`} />
    </span>
  );
}

export function BacktestRunDetail({
  run,
  listHref,
  applyDesks,
  applyTemplateId = null,
  canPublish,
  canRemove,
  canAttach = false,
  canSaveAs = false,
  sourceTemplateName = null,
  linkedTemplateName = null,
  returnTo,
  comparables = [],
  parentHref,
}: {
  run: BacktestRun;
  listHref: string;
  applyDesks?: Array<{ id: string; name: string }>;
  applyTemplateId?: string | null;
  canPublish: boolean;
  canRemove: boolean;
  canAttach?: boolean;
  canSaveAs?: boolean;
  sourceTemplateName?: string | null;
  linkedTemplateName?: string | null;
  returnTo: string;
  comparables?: BacktestRun[];
  parentHref?: string | null;
}) {
  const params = recipeParamRows(run.recipe);
  const complete = run.status === "done";
  const pendingMessage = incompleteRunMessage(run);
  const status = backtestStatusTone(run.status);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Backtest
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {run.recipe.name}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {run.symbol} · {run.venue} ·{" "}
            {DCA_INDICATOR_TIMEFRAME_LABELS[run.interval]} · start{" "}
            {run.startingUsdt.toLocaleString()} ·{" "}
            {BACKTEST_FEE_PRESETS[run.feePreset].label}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href={listHref} className="text-accent hover:underline">
              All backtests
            </Link>
            <Link
              href={backtestRerunHref(run.id)}
              className="text-accent hover:underline"
            >
              Re-run Parameters
            </Link>
            {parentHref ? (
              <Link href={parentHref} className="text-accent hover:underline">
                Primary pair
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-start justify-end gap-2">
          <div className="rounded-card border border-line bg-surface px-3 py-2">
            <p className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
              Status
            </p>
            <div
              className={`mt-1 flex items-center gap-2 text-sm ${
                status.tone === "warning"
                  ? "text-warning"
                  : status.tone === "danger"
                    ? "text-danger"
                    : status.tone === "faint"
                      ? "text-ink-muted"
                      : "text-success"
              }`}
            >
              <StatusDot tone={status.tone} pulse={status.pulse} />
              {status.label}
            </div>
          </div>
          {canAttach ? (
            <AttachBacktestButton
              runId={run.id}
              sourceName={sourceTemplateName}
            />
          ) : null}
          {canSaveAs ? (
            <SaveBacktestAsTemplateButton
              runId={run.id}
              defaultName={run.recipe.name}
            />
          ) : null}
          {linkedTemplateName ? (
            <p className="text-xs text-ink-muted">
              Attached to {linkedTemplateName}
            </p>
          ) : null}
          {run.status === "done" && applyDesks ? (
            <ApplyBacktestButton
              templateId={applyTemplateId}
              desks={applyDesks}
            />
          ) : null}
          {run.status === "done" ? (
            <PublishBacktestButton runId={run.id} canPublish={canPublish} />
          ) : null}
          <RemoveBacktestButton
            runId={run.id}
            canRemove={canRemove}
            returnTo={returnTo}
          />
        </div>
      </div>

      <BacktestHeaderStats run={run} />

      {run.error ? <p className="text-sm text-danger">{run.error}</p> : null}
      {run.status === "queued" || run.status === "running" ? (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          {run.status === "queued"
            ? "Queued. The engine worker will pick this up and work through the history."
            : "Running. Refresh in a moment."}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Parameters</h2>
            <Link
              href={backtestRerunHref(run.id)}
              className="text-sm text-accent hover:underline"
            >
              Re-run Parameters
            </Link>
          </div>
          <BacktestPropertyList rows={params} />
        </section>
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Performance</h2>
            {complete ? (
              <BacktestStatsGrid run={run} />
            ) : (
              <SectionPlaceholder message={pendingMessage} />
            )}
          </section>
          {complete ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Current trades</h2>
              <BacktestCurrentTrades run={run} />
            </section>
          ) : null}
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Account impact</h2>
        {complete ? (
          <BacktestEquityPanel run={run} />
        ) : (
          <SectionPlaceholder message={pendingMessage} />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Chart</h2>
        {complete ? (
          <BacktestInlineChart run={run} />
        ) : (
          <SectionPlaceholder message={pendingMessage} />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Orders</h2>
        {complete ? (
          <BacktestOrdersTable run={run} />
        ) : (
          <SectionPlaceholder message={pendingMessage} />
        )}
      </section>

      {complete && comparables.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Comparables</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Pair</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Trades</th>
                  <th className="py-2 pr-4 font-medium">Return</th>
                  <th className="py-2 font-medium">Realized</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  <td className="py-2 pr-4 tabular-nums">{run.symbol}</td>
                  <td className="py-2 pr-4">{statusLabel(run.status)}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {run.stats?.trades ?? "—"}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">
                    {formatBacktestReturnPct(
                      run.stats ? realizedReturnPct(run.stats) : null,
                    )}
                  </td>
                  <td className="py-2 tabular-nums">
                    {run.stats
                      ? run.stats.realizedUsdt.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </td>
                </tr>
                {comparables.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-2 pr-4">
                      <Link
                        href={`${listHref}/${row.id}`}
                        className="tabular-nums text-accent hover:underline"
                      >
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{statusLabel(row.status)}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.stats?.trades ?? "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {formatBacktestReturnPct(
                        row.stats ? realizedReturnPct(row.stats) : null,
                      )}
                    </td>
                    <td className="py-2 tabular-nums">
                      {row.stats
                        ? row.stats.realizedUsdt.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function incompleteRunMessage(run: BacktestRun): string {
  if (run.status === "queued") {
    return "Queued. Results will appear here when the replay finishes.";
  }
  if (run.status === "running") {
    return "Still running. Refresh in a moment — results will fill in when this finishes.";
  }
  if (run.status === "failed") {
    return "No results — this run failed.";
  }
  if (run.status === "cancelled") {
    return "No results — this run was cancelled.";
  }
  return "Results will appear when this run finishes.";
}

function SectionPlaceholder({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
      {message}
    </div>
  );
}

function formatWindowDate(ms: number): string {
  return formatAuDateUtc(ms);
}

function signedMoney(value: number): string {
  const text = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value > 0) {
    return `+$${text}`;
  }
  if (value < 0) {
    return `−$${text}`;
  }
  return `$${text}`;
}

function BacktestHeaderStats({ run }: { run: BacktestRun }) {
  const stats = run.stats;
  const peakUsed = peakLockedNotionalUsdt(run.orders);
  const usedPct = stats
    ? returnOnCapitalUsedPct(stats.realizedUsdt, peakUsed)
    : null;
  const apr = stats
    ? realizedAprPct(stats.realizedUsdt, peakUsed, run.fromMs, run.toMs)
    : null;
  const winRate =
    stats && Number.isFinite(stats.winRate)
      ? `${(stats.winRate * 100).toFixed(1)}%`
      : "—";
  return (
    <section className="rounded-card border border-line bg-surface px-5 py-5">
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-6">
        <KpiBlock
          label="Start"
          value={formatWindowDate(run.fromMs)}
          size="date"
        />
        <KpiBlock
          label="End"
          value={formatWindowDate(run.toMs)}
          size="date"
        />
        <KpiBlock
          label="Win rate"
          value={winRate}
          hint={stats ? `${stats.trades} trades` : undefined}
          toneClass={stats && stats.trades > 0 ? "text-ink" : signedTone(null)}
        />
        <KpiBlock
          label="Realized P&L"
          value={stats ? signedMoney(stats.realizedUsdt) : "—"}
          toneClass={signedTone(stats?.realizedUsdt ?? null)}
        />
        <KpiBlock
          label="On Capital Used"
          value={formatBacktestReturnPct(usedPct)}
          toneClass={signedTone(usedPct)}
        />
        <KpiBlock
          label="APR"
          value={formatBacktestReturnPct(apr)}
          hint="On max capital used"
          toneClass={signedTone(apr)}
        />
      </div>
    </section>
  );
}

function KpiBlock({
  label,
  value,
  hint,
  toneClass,
  size = "metric",
}: {
  label: string;
  value: string;
  hint?: string;
  toneClass?: string;
  size?: "date" | "metric";
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-2 font-semibold tracking-tight tabular-nums ${
          size === "date" ? "text-lg" : "text-xl"
        } ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
