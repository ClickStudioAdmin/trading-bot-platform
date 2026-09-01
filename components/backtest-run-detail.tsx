import Link from "next/link";
import type { ReactNode } from "react";
import { BacktestEquityPanel } from "@/components/backtest-equity";
import {
  ApplyBacktestButton,
  AttachBacktestButton,
  BacktestCurrentTrades,
  BacktestRunRefresh,
  BacktestInlineChart,
  BacktestOrdersTable,
  BacktestPropertyList,
  BacktestStatsGrid,
  BacktestOriginBadges,
  PublishBacktestButton,
  RemoveBacktestButton,
  SaveBacktestAsPlatformButton,
  SaveBacktestAsTemplateButton,
} from "@/components/backtest-run-view";
import { ColumnHint } from "@/components/column-hint";
import {
  BACKTEST_FEE_PRESETS,
  backtestAprPct,
  backtestRerunHref,
  backtestRoePct,
  backtestWindowDays,
  formatBacktestReturnPct,
  realizedReturnPct,
  type BacktestRun,
} from "@/lib/backtest/model";
import {
  buildEquityTimeline,
  maxDrawdownFromEquity,
  recipeParamRows,
} from "@/lib/backtest/study";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import {
  formatCount,
  formatPct,
  formatSignedUsd,
  signedTone,
} from "@/lib/opportunities/format";

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

function ActionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
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
  canSaveAsPlatform = false,
  sourceTemplateName = null,
  attachTemplateId = null,
  matchingTemplateName = null,
  matchingDeskLabel = null,
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
  canSaveAsPlatform?: boolean;
  sourceTemplateName?: string | null;
  attachTemplateId?: string | null;
  matchingTemplateName?: string | null;
  matchingDeskLabel?: string | null;
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
      <BacktestRunRefresh
        active={run.status === "queued" || run.status === "running"}
        runId={run.id}
      />
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
            {run.startingUsdt.toLocaleString()} · {run.leverage}× ·{" "}
            {BACKTEST_FEE_PRESETS[run.feePreset].label}
          </p>
          {matchingTemplateName || matchingDeskLabel ? (
            <div className="mt-3">
              <BacktestOriginBadges
                templateName={matchingTemplateName}
                deskLabel={matchingDeskLabel}
              />
            </div>
          ) : null}
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
        <div className="mt-6 flex flex-col items-end gap-2">
          <div
            className={`flex items-center gap-2 text-sm ${
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
          <div className="flex items-end justify-end gap-4">
            {canAttach || canSaveAs || linkedTemplateName ? (
              <ActionGroup label="Library">
                {canAttach ? (
                  <AttachBacktestButton
                    runId={run.id}
                    sourceName={matchingTemplateName ?? sourceTemplateName}
                    templateId={attachTemplateId ?? ""}
                  />
                ) : null}
                {canSaveAs ? (
                  <SaveBacktestAsTemplateButton
                    runId={run.id}
                    defaultName={run.recipe.name}
                  />
                ) : null}
                {linkedTemplateName ? (
                  <p className="whitespace-nowrap text-sm text-ink-muted">
                    Saved · {linkedTemplateName}
                  </p>
                ) : null}
              </ActionGroup>
            ) : null}
            {complete && applyTemplateId && applyDesks && applyDesks.length > 0 ? (
              <ActionGroup label="Desk">
                <ApplyBacktestButton
                  templateId={applyTemplateId}
                  desks={applyDesks}
                />
              </ActionGroup>
            ) : null}
            {canSaveAsPlatform ? (
              <ActionGroup label="Platform">
                <SaveBacktestAsPlatformButton
                  runId={run.id}
                  defaultName={run.recipe.name}
                />
              </ActionGroup>
            ) : null}
            {complete && canPublish ? (
              <ActionGroup label="Share">
                <PublishBacktestButton runId={run.id} canPublish={canPublish} />
              </ActionGroup>
            ) : null}
            <RemoveBacktestButton
              runId={run.id}
              canRemove={canRemove}
              returnTo={returnTo}
            />
          </div>
        </div>
      </div>

      <BacktestHeaderStats run={run} />

      {run.error ? <p className="text-sm text-danger">{run.error}</p> : null}
      {run.status === "queued" || run.status === "running" ? (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          {run.status === "queued"
            ? "Queued. Starting this run now."
            : "Running. This page refreshes until it finishes."}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Parameters</h2>
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
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint [&_th]:whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 font-medium">Pair</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Trades</th>
                  <th className="px-4 py-3 font-medium">Account return</th>
                  <th className="px-4 py-3 font-medium">Realized</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="px-4 py-3 font-medium tabular-nums">
                    {run.symbol}
                  </td>
                  <td className="px-4 py-3">{statusLabel(run.status)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {run.stats?.trades ?? "—"}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums ${signedTone(
                      run.stats ? realizedReturnPct(run.stats) : null,
                    )}`}
                  >
                    {formatBacktestReturnPct(
                      run.stats ? realizedReturnPct(run.stats) : null,
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums ${
                      run.stats
                        ? signedTone(run.stats.realizedUsdt)
                        : "text-ink-faint"
                    }`}
                  >
                    {run.stats
                      ? run.stats.realizedUsdt.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </td>
                </tr>
                {comparables.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`${listHref}/${row.id}`}
                        className="font-medium tabular-nums text-accent hover:underline"
                      >
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{statusLabel(row.status)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.stats?.trades ?? "—"}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums ${signedTone(
                        row.stats ? realizedReturnPct(row.stats) : null,
                      )}`}
                    >
                      {formatBacktestReturnPct(
                        row.stats ? realizedReturnPct(row.stats) : null,
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums ${
                        row.stats
                          ? signedTone(row.stats.realizedUsdt)
                          : "text-ink-faint"
                      }`}
                    >
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
    return "Still running. Results will fill in when this finishes.";
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
  const empty = !stats || stats.trades === 0;
  const tradingDays = backtestWindowDays(run.fromMs, run.toMs);
  const onBook = stats ? realizedReturnPct(stats) : null;
  const roe = stats
    ? backtestRoePct(stats.realizedUsdt, run.orders, run.leverage)
    : null;
  const apr = stats
    ? backtestAprPct(
        stats.realizedUsdt,
        stats.startingUsdt,
        run.fromMs,
        run.toMs,
      )
    : null;
  const equityDd = stats
    ? maxDrawdownFromEquity(buildEquityTimeline(run))
    : null;
  const winRate =
    stats && stats.trades > 0
      ? `${Math.round(stats.winRate * 100)}%`
      : "—";
  return (
    <section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Days Trading"
          value={tradingDays != null ? formatCount(tradingDays) : "—"}
          hint="Inclusive UTC days of the replay window (start to end)."
        />
        <StatCard
          label="Completed Trades"
          value={stats ? formatCount(stats.trades) : "—"}
        />
        <StatCard label="Win Rate" value={winRate} />
        <StatCard
          label="Max Drawdown"
          value={
            empty || equityDd == null || equityDd.maxDrawdownPct == null
              ? "—"
              : formatPct(equityDd.maxDrawdownPct)
          }
          toneClass={
            empty || !equityDd || !(equityDd.maxDrawdownUsdt > 0)
              ? undefined
              : signedTone(-equityDd.maxDrawdownUsdt)
          }
          hint="Peak-to-trough of marked equity. Percent is versus that peak."
          note={
            empty || !equityDd || !(equityDd.maxDrawdownUsdt > 0)
              ? undefined
              : formatSignedUsd(-equityDd.maxDrawdownUsdt)
          }
        />
        <StatCard
          label="Realized Profit"
          value={stats ? signedMoney(stats.realizedUsdt) : "—"}
          toneClass={signedTone(stats?.realizedUsdt ?? null)}
          hint="Closed-trade dollars after fees. Leverage does not change this amount."
        />
        <StatCard
          label="P&L"
          value={empty || onBook == null ? "—" : formatPct(onBook)}
          toneClass={signedTone(empty ? null : stats.realizedUsdt)}
          hint="Realized profit ÷ starting balance."
          note="Based on starting balance"
        />
        <StatCard
          label="ROE"
          value={empty || roe == null ? "—" : formatPct(roe)}
          toneClass={signedTone(empty ? null : roe)}
          hint="Realized profit ÷ initial margin (position value ÷ leverage)."
          note="Based on margin requirement"
        />
        <StatCard
          label="APR"
          value={empty || apr == null ? "—" : formatPct(apr)}
          toneClass={signedTone(empty ? null : apr)}
          hint="Compound annualization of account return over the replay window. Short windows inflate APR."
          note="Annualized account return"
        />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  note,
  toneClass,
}: {
  label: string;
  value: string;
  hint?: string;
  note?: string;
  toneClass?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {hint ? <ColumnHint label={label} hint={hint} /> : label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
      {note ? <p className="mt-2 text-xs text-ink-faint">{note}</p> : null}
    </div>
  );
}
