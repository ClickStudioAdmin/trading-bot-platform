import Link from "next/link";
import { BacktestEquityPanel } from "@/components/backtest-equity";
import {
  ApplyBacktestButton,
  AttachBacktestButton,
  BacktestInlineChart,
  BacktestOrdersTable,
  BacktestStatsGrid,
  PublishBacktestButton,
  RemoveBacktestButton,
  SaveBacktestAsTemplateButton,
} from "@/components/backtest-run-view";
import { BACKTEST_FEE_PRESETS } from "@/lib/backtest/model";
import type { BacktestRun } from "@/lib/backtest/model";
import { formatBacktestReturnPct } from "@/lib/backtest/model";
import { recipeParamRows } from "@/lib/backtest/study";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function BacktestRunDetail({
  run,
  listHref,
  studyHref,
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
  studyHref?: string | null;
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
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            {run.studyId ? "Study scenario" : "Backtest"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {run.recipe.name}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {run.symbol} · {run.venue} ·{" "}
            {DCA_INDICATOR_TIMEFRAME_LABELS[run.interval]} ·{" "}
            {new Date(run.fromMs).toISOString().slice(0, 10)}–
            {new Date(run.toMs).toISOString().slice(0, 10)} · start{" "}
            {run.startingUsdt.toLocaleString()} ·{" "}
            {BACKTEST_FEE_PRESETS[run.feePreset].label} ·{" "}
            {statusLabel(run.status)}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href={listHref} className="text-accent hover:underline">
              All backtests
            </Link>
            {studyHref ? (
              <Link href={studyHref} className="text-accent hover:underline">
                Study
              </Link>
            ) : null}
            {parentHref ? (
              <Link href={parentHref} className="text-accent hover:underline">
                Primary pair
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {run.error ? <p className="text-sm text-danger">{run.error}</p> : null}
      {run.status === "queued" || run.status === "running" ? (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          {run.status === "queued"
            ? "Queued. The engine worker will pick this up and work through the history."
            : "Running. Refresh in a moment."}
        </p>
      ) : null}

      {comparables.length > 0 ? (
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
                    {formatBacktestReturnPct(run.stats?.returnPct)}
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
                      {formatBacktestReturnPct(row.stats?.returnPct)}
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

      <section>
        <h2 className="mb-3 text-lg font-semibold">Parameters</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {params.map((row) => (
            <div
              key={row.label}
              className="rounded-card border border-line bg-surface px-4 py-3"
            >
              <dt className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                {row.label}
              </dt>
              <dd className="mt-1 text-sm font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Performance</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Account return is P&amp;L versus the starting balance. On capital
          used is the same dollars versus the largest open position (qty ×
          entry) during the run. Not exchange-margin ROE.
        </p>
        <BacktestStatsGrid run={run} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Account impact</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Equity after each simulated fill, from the starting balance.
        </p>
        <BacktestEquityPanel run={run} />
      </section>

      {run.status === "done" ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Chart</h2>
          <BacktestInlineChart run={run} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Trades</h2>
        <BacktestOrdersTable run={run} />
      </section>
    </div>
  );
}
