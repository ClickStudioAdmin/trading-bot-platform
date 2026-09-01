"use client";

import { useEffect, useRef, useState } from "react";
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
  attachBacktestToTemplateAction,
  deleteBacktestAction,
  saveBacktestAsPlatformTemplateAction,
  saveBacktestAsTemplateAction,
} from "@/lib/backtest/actions";
import { applyTemplateAction } from "@/lib/templates/actions";
import {
  backtestActivityBounds,
  backtestMarginUsdt,
  chartIntervalForWindow,
  formatBacktestReturnPct,
  peakLockedNotionalUsdt,
  realizedEndingUsdt,
  realizedReturnPct,
  splitCompletedBacktestOrders,
  type BacktestRun,
} from "@/lib/backtest/model";
import {
  buildBacktestChartOverlay,
  snapOverlayToCandles,
} from "@/lib/charts/overlay";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import { clipCandlesToWindow, type CandleBar } from "@/lib/market/candles";
import { formatQty, signedTone } from "@/lib/opportunities/format";

function candlesForBacktestChart(
  candles: CandleBar[],
  run: BacktestRun,
): CandleBar[] {
  const bounds = backtestActivityBounds(run);
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
    return (
      <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
        No simulated fills.
      </p>
    );
  }
  const pageCount = Math.max(1, Math.ceil(fills.length / TRADE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * TRADE_PAGE_SIZE;
  const rows = fills.slice(start, start + TRADE_PAGE_SIZE);
  const from = start + 1;
  const to = start + rows.length;
  return (
    <div>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint [&_th]:whitespace-nowrap">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Fee</th>
              <th className="px-4 py-3 font-medium">Realized</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const current = openSet.has(row);
              const realized = current ? null : row.realizedUsdt;
              return (
                <tr
                  key={`${row.atMs}-${start + index}`}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                    {new Date(row.atMs).toLocaleString("en-AU")}
                  </td>
                  <td className="px-4 py-3">
                    {current
                      ? "Open"
                      : row.action === "flatten"
                        ? "Close"
                        : row.action === "buy"
                          ? "Buy"
                          : row.action === "sell"
                            ? "Sell"
                            : row.action}
                  </td>
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
          setCandles(candlesForBacktestChart(rows, run));
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
      screenshotName={`${run.symbol}-backtest.png`}
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
          setCandles(candlesForBacktestChart(rows, run));
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
                screenshotName={`${run.symbol}-backtest.png`}
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
        <p className="rounded-control bg-accent/15 px-2 py-0.5 text-xs text-accent">
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
        {pending
          ? "Attaching…"
          : sourceName
            ? `Attach to ${sourceName}`
            : "Attach"}
      </button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}

const saveFieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const savePrimaryBtn =
  "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const saveSecondaryBtn =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";

export function SaveBacktestAsTemplateButton({
  runId,
  defaultName,
  deskType,
  folders = [],
  isAdmin = false,
  canSaveAs,
  canSaveAsPlatform,
  variant = "primary",
}: {
  runId: string;
  defaultName: string;
  deskType: TemplateDeskType;
  folders?: AutomationTemplateSet[];
  isAdmin?: boolean;
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
  const [folderIds, setFolderIds] = useState<Set<string>>(new Set());
  const [createFolder, setCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [starterPack, setStarterPack] = useState(false);
  const folderGroups = saveFolderGroups(folders, deskType, platform);

  if (!canSaveAs && !canSaveAsPlatform) {
    return null;
  }

  function toggleFolder(id: string) {
    setFolderIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetAndOpen() {
    setName(defaultName);
    setPlatform(platformOnly);
    setFolderIds(new Set());
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
        className={
          variant === "secondary"
            ? "w-full rounded-control border border-line px-3 py-2 text-sm text-ink hover:border-line-strong"
            : "w-full rounded-control bg-accent-strong px-3 py-2 text-sm font-medium text-ink hover:bg-accent"
        }
      >
        {platformOnly ? "Save as platform template" : "Save as template"}
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
          <label className="mt-4 block text-xs text-ink-muted">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              className={saveFieldClass}
            />
          </label>
          {isAdmin && canSaveAsPlatform && canSaveAs ? (
            <label className="mt-3 flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={platform}
                onChange={(event) => {
                  setPlatform(event.target.checked);
                  setFolderIds(new Set());
                  setCreateFolder(false);
                  setNewFolderName("");
                  setStarterPack(false);
                }}
                className="mt-0.5 size-4"
              />
              Save as platform template
            </label>
          ) : null}
          {platform ? (
            <StarterPackCheckbox
              checked={starterPack}
              onChange={setStarterPack}
            />
          ) : null}
          <div className="mt-3">
            <p className="text-xs text-ink-muted">Add to folder</p>
            {folderGroups.length === 0 ? (
              <p className="mt-1 text-sm text-ink-faint">
                {platform
                  ? "None yet. Create one below."
                  : "None yet. Create one below or on My Folders."}
              </p>
            ) : (
              <div className="mt-1 space-y-3">
                {folderGroups.map((group) => (
                  <div key={group.label}>
                    {folderGroups.length > 1 ? (
                      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                        {group.label}
                      </p>
                    ) : null}
                    <ul className="mt-1 space-y-1 rounded-control border border-line bg-canvas px-3 py-2">
                      {group.rows.map((row) => (
                        <li key={row.id}>
                          <label className="flex items-start gap-2 text-sm text-ink">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4"
                              checked={folderIds.has(row.id)}
                              onChange={() => toggleFolder(row.id)}
                            />
                            <span>
                              <span className="block font-medium">{row.name}</span>
                              <span className="block text-xs text-ink-muted">
                                {row.items.length === 0
                                  ? "Empty folder"
                                  : `${row.items.length} template${row.items.length === 1 ? "" : "s"}`}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={createFolder}
              onChange={(event) => setCreateFolder(event.target.checked)}
              className="mt-1 size-4"
            />
            {platform ? "Create a new platform folder" : "Create a new folder"}
          </label>
          {createFolder ? (
            <label className="mt-2 block text-xs text-ink-muted">
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
      className="space-y-2"
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
        aria-label="Desk"
        className="w-full rounded-control border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
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
        title="Copies the bot onto that desk idle. Does not arm."
        className="w-full rounded-control border border-line px-3 py-2 text-sm text-ink hover:border-line-strong disabled:opacity-50"
      >
        {pending ? "Copying…" : "Add to desk"}
      </button>
      {message ? <p className="text-xs text-ink-muted">{message}</p> : null}
    </form>
  );
}

export function RemoveBacktestButton({
  runId,
  canRemove,
  returnTo = "/account/backtests",
  compact = false,
  stacked = false,
}: {
  runId: string;
  canRemove: boolean;
  returnTo?: string;
  compact?: boolean;
  stacked?: boolean;
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
          stacked
            ? "w-full rounded-control px-0 py-1 text-left text-sm text-danger hover:underline disabled:opacity-50"
            : compact
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
