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
  RemoveBacktestButton,
  SaveBacktestAsTemplateButton,
} from "@/components/backtest-run-view";
import { ColumnHint } from "@/components/column-hint";
import { BacktestRunsTable } from "@/components/backtest-runs-table";
import type { AutomationTemplateSet } from "@/lib/templates/store";
import {
  BACKTEST_FEE_PRESETS,
  backtestAprPct,
  backtestDrawdownCard,
  backtestRerunHref,
  backtestRoePct,
  backtestRunTitle,
  backtestWindowDays,
  formatBacktestReturnPct,
  realizedReturnPct,
  type BacktestRun,
} from "@/lib/backtest/model";
import { recipeParamRows } from "@/lib/backtest/study";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import {
  formatCount,
  formatPct,
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

function MatchPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="min-w-[14rem] flex-1 rounded-card border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {title}
      </p>
      <div className="mt-3 space-y-2">{children}</div>
    </aside>
  );
}

function BacktestMatchCard({
  runId,
  defaultName,
  deskType,
  matchingTemplateName,
  matchingDeskLabel,
  matchingDeskHref,
  linkedTemplateName,
  canAttach,
  canSaveAs,
  canSaveAsPlatform,
  sourceTemplateName,
  attachTemplateId,
  applyDesks,
  isAdmin,
  folders,
}: {
  runId: string;
  defaultName: string;
  deskType: BacktestRun["deskType"];
  matchingTemplateName: string | null;
  matchingDeskLabel: string | null;
  matchingDeskHref: string | null;
  linkedTemplateName: string | null;
  canAttach: boolean;
  canSaveAs: boolean;
  canSaveAsPlatform: boolean;
  sourceTemplateName: string | null;
  attachTemplateId: string | null;
  applyDesks?: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  folders: AutomationTemplateSet[];
}) {
  return (
    <div className="flex w-full max-w-xl flex-wrap gap-3">
      <MatchPanel title="Template Bot Matching">
        {matchingTemplateName ? (
          <p className="rounded-control bg-success/15 px-2 py-0.5 text-xs text-success">
            Template · {matchingTemplateName}
          </p>
        ) : (
          <p className="text-sm text-ink-faint">No matching template</p>
        )}
        {canAttach ? (
          <AttachBacktestButton
            runId={runId}
            sourceName={matchingTemplateName ?? sourceTemplateName}
            templateId={attachTemplateId ?? ""}
          />
        ) : linkedTemplateName ? (
          <p className="rounded-control bg-success/15 px-3 py-1.5 text-center text-sm text-success">
            Results Attached
          </p>
        ) : null}
        {canSaveAs ? (
          <SaveBacktestAsTemplateButton
            runId={runId}
            defaultName={defaultName}
            deskType={deskType}
            folders={folders}
            canSaveAs
            canSaveAsPlatform={false}
          />
        ) : null}
        {canSaveAsPlatform ? (
          <SaveBacktestAsTemplateButton
            runId={runId}
            defaultName={defaultName}
            deskType={deskType}
            folders={folders}
            canSaveAs={false}
            canSaveAsPlatform
            variant="secondary"
          />
        ) : null}
      </MatchPanel>
      <MatchPanel title="Desk Bot Matching">
        {matchingDeskLabel ? (
          <p className="rounded-control bg-success/15 px-2 py-0.5 text-xs text-success">
            Desk · {matchingDeskLabel}
          </p>
        ) : (
          <p className="text-sm text-ink-faint">No matching desk bot</p>
        )}
        {matchingDeskHref ? (
          <Link
            href={matchingDeskHref}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent hover:underline"
          >
            Go to Bot
          </Link>
        ) : applyDesks && applyDesks.length > 0 ? (
          <ApplyBacktestButton
            runId={runId}
            defaultName={defaultName}
            desks={applyDesks}
          />
        ) : null}
      </MatchPanel>
    </div>
  );
}

export function BacktestRunDetail({
  run,
  listHref,
  applyDesks,
  canRemove,
  canAttach = false,
  canSaveAs = false,
  canSaveAsPlatform = false,
  sourceTemplateName = null,
  attachTemplateId = null,
  matchingTemplateName = null,
  matchingDeskLabel = null,
  matchingDeskHref = null,
  linkedTemplateName = null,
  isAdmin = false,
  memberId,
  folders = [],
  returnTo,
  comparables = [],
  comparablePrimary = null,
}: {
  run: BacktestRun;
  listHref: string;
  applyDesks?: Array<{ id: string; name: string }>;
  canRemove: boolean;
  canAttach?: boolean;
  canSaveAs?: boolean;
  canSaveAsPlatform?: boolean;
  sourceTemplateName?: string | null;
  attachTemplateId?: string | null;
  matchingTemplateName?: string | null;
  matchingDeskLabel?: string | null;
  matchingDeskHref?: string | null;
  linkedTemplateName?: string | null;
  isAdmin?: boolean;
  memberId: string;
  folders?: AutomationTemplateSet[];
  returnTo: string;
  comparables?: BacktestRun[];
  comparablePrimary?: BacktestRun | null;
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
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Backtest
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {backtestRunTitle(run)}
            </h1>
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
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {run.symbol} · {run.venue} ·{" "}
            {DCA_INDICATOR_TIMEFRAME_LABELS[run.interval]} · start{" "}
            {run.startingUsdt.toLocaleString()} · {run.leverage}× ·{" "}
            {BACKTEST_FEE_PRESETS[run.feePreset].label}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Link href={listHref} className="text-accent hover:underline">
              All backtests
            </Link>
            <RemoveBacktestButton
              runId={run.id}
              canRemove={canRemove}
              returnTo={returnTo}
              inline
            />
          </div>
        </div>
        <BacktestMatchCard
          runId={run.id}
          defaultName={backtestRunTitle(run)}
          deskType={run.deskType}
          matchingTemplateName={matchingTemplateName}
          matchingDeskLabel={matchingDeskLabel}
          matchingDeskHref={matchingDeskHref}
          linkedTemplateName={linkedTemplateName}
          canAttach={canAttach}
          canSaveAs={canSaveAs}
          canSaveAsPlatform={canSaveAsPlatform}
          sourceTemplateName={sourceTemplateName}
          attachTemplateId={attachTemplateId}
          applyDesks={applyDesks}
          isAdmin={isAdmin}
          folders={folders}
        />
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
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Parameters</h2>
            <Link
              href={backtestRerunHref(run.id)}
              className="text-sm text-accent hover:underline"
            >
              Load into new backtest
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

      {comparablePrimary && comparables.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Comparables</h2>
          <BacktestRunsTable
            runs={[
              comparablePrimary,
              ...comparables.filter((row) => row.id !== comparablePrimary.id),
            ]}
            memberId={memberId}
            isAdmin={isAdmin}
            primaryRunId={comparablePrimary.id}
            returnTo={`${listHref}/${run.id}`}
          />
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
  const drawdown = stats
    ? backtestDrawdownCard(stats)
    : { value: "—", toneClass: "text-ink" };
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
          value={drawdown.value}
          toneClass={drawdown.toneClass}
          hint="Peak-to-trough of marked equity versus that peak, plus the dollar dip. Same book as paper Performance."
          note={drawdown.note}
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
