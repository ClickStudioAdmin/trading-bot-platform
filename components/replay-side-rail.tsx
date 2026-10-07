"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { BacktestQueueForm } from "@/components/backtest-queue-form";
import {
  ApplyBacktestButton,
  BacktestPropertyList,
  BacktestStatsGrid,
  SaveBacktestAsTemplateButton,
} from "@/components/backtest-run-view";
import {
  IconActivity,
  IconChevronDown,
  IconLoader,
  IconPerformance,
  IconPositions,
} from "@/components/icons";
import { nudgeBacktestRunAction } from "@/lib/backtest/actions";
import { recipeParamRows } from "@/lib/backtest/library";
import {
  backtestQueueSeedFromRun,
  backtestRunTitle,
  isoDateUtc,
  type BacktestRun,
} from "@/lib/backtest/model";
import {
  backtestVariantChangeLabel,
  completedBacktestVariantIds,
} from "@/lib/backtest/variant-label";
import type { AutomationTemplateSet } from "@/lib/templates/store";

const RAIL_KEY = "tbp-replay-rail";
const RAIL_EVENT = "tbp-replay-rail";

type OptimisticVariant = { token: string; runId: string | null };

let optimisticVariants: OptimisticVariant[] = [];
const optimisticListeners = new Set<() => void>();
const emptyOptimistic: OptimisticVariant[] = [];

function publishOptimistic(next: OptimisticVariant[]) {
  optimisticVariants = next;
  for (const listener of optimisticListeners) {
    listener();
  }
}

function subscribeOptimistic(onStoreChange: () => void) {
  optimisticListeners.add(onStoreChange);
  return () => optimisticListeners.delete(onStoreChange);
}

export function beginOptimisticVariant(): string {
  const token = `${Date.now()}-${optimisticVariants.length}`;
  publishOptimistic([...optimisticVariants, { token, runId: null }]);
  return token;
}

export function resolveOptimisticVariant(token: string, runId: string) {
  publishOptimistic(
    optimisticVariants.map((row) =>
      row.token === token ? { token, runId } : row,
    ),
  );
}

export function clearOptimisticVariant(token: string) {
  publishOptimistic(optimisticVariants.filter((row) => row.token !== token));
}

export function dropCoveredOptimisticVariants(runIds: ReadonlySet<string>) {
  const next = optimisticVariants.filter(
    (row) => row.runId == null || !runIds.has(row.runId),
  );
  if (next.length !== optimisticVariants.length) {
    publishOptimistic(next);
  }
}

export function useOptimisticVariants(): OptimisticVariant[] {
  return useSyncExternalStore(
    subscribeOptimistic,
    () => optimisticVariants,
    () => emptyOptimistic,
  );
}

export type ReplayRailPanel = "positions" | "parameters" | "statistics" | "closed";

function railSnapshot(): ReplayRailPanel {
  const raw = sessionStorage.getItem(RAIL_KEY);
  if (
    raw === "positions" ||
    raw === "parameters" ||
    raw === "statistics" ||
    raw === "closed"
  ) {
    return raw;
  }
  return "positions";
}

function railServerSnapshot(): ReplayRailPanel {
  return "positions";
}

function subscribeRail(onStoreChange: () => void) {
  window.addEventListener(RAIL_EVENT, onStoreChange);
  return () => window.removeEventListener(RAIL_EVENT, onStoreChange);
}

function writeRail(next: ReplayRailPanel) {
  sessionStorage.setItem(RAIL_KEY, next);
  window.dispatchEvent(new Event(RAIL_EVENT));
}

export function useReplayRail(): ReplayRailPanel {
  return useSyncExternalStore(subscribeRail, railSnapshot, railServerSnapshot);
}

export function selectReplayRail(next: Exclude<ReplayRailPanel, "closed">, current: ReplayRailPanel) {
  writeRail(current === next ? "closed" : next);
}

export function ReplayRailNav({
  panel,
  runningCount,
  className,
}: {
  panel: ReplayRailPanel;
  runningCount: number;
  className: string;
}) {
  return (
    <nav aria-label="Replay panels" className={className}>
      <RailButton
        label="Positions"
        pressed={panel === "positions"}
        onClick={() => selectReplayRail("positions", panel)}
        icon={<IconPositions className="size-5" />}
      />
      <RailButton
        label="Parameters"
        pressed={panel === "parameters"}
        onClick={() => selectReplayRail("parameters", panel)}
        badge={runningCount}
        icon={<IconActivity className="size-5" />}
      />
      <RailButton
        label="Statistics"
        pressed={panel === "statistics"}
        onClick={() => selectReplayRail("statistics", panel)}
        icon={<IconPerformance className="size-5" />}
      />
    </nav>
  );
}

export function ReplayRailBody({
  panel,
  run,
  rootId,
  positions,
  allowKeep,
  allowKeepPlatform,
  folders,
  applyDesks,
}: {
  panel: Exclude<ReplayRailPanel, "closed">;
  run: BacktestRun;
  rootId: string;
  positions: ReactNode;
  allowKeep: boolean;
  allowKeepPlatform: boolean;
  folders: AutomationTemplateSet[];
  applyDesks: Array<{ id: string; name: string }>;
}) {
  if (panel === "positions") {
    return positions;
  }
  if (panel === "statistics") {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h2 className="mb-3 text-lg font-semibold">Performance</h2>
        <BacktestStatsGrid run={run} />
      </div>
    );
  }
  return (
    <ParametersBody
      run={run}
      rootId={rootId}
      allowKeep={allowKeep}
      allowKeepPlatform={allowKeepPlatform}
      folders={folders}
      applyDesks={applyDesks}
    />
  );
}

function ParametersBody({
  run,
  rootId,
  allowKeep,
  allowKeepPlatform,
  folders,
  applyDesks,
}: {
  run: BacktestRun;
  rootId: string;
  allowKeep: boolean;
  allowKeepPlatform: boolean;
  folders: AutomationTemplateSet[];
  applyDesks: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pendingToken = useRef<string | null>(null);
  const [modifying, setModifying] = useState(false);
  const variant = run.id !== rootId;
  const seed = useMemo(() => {
    const next = backtestQueueSeedFromRun(run);
    return { ...next, comparables: [] as string[] };
  }, [run]);
  const paramRows = [
    ...recipeParamRows(run.recipe),
    { label: "Leverage", value: `${run.leverage}×` },
    {
      label: "Initial balance",
      value: `$${run.startingUsdt.toLocaleString()}`,
    },
    { label: "Window start", value: isoDateUtc(run.fromMs) },
    { label: "Window end", value: isoDateUtc(run.toMs) },
  ];

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
      {modifying ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Modify</h2>
            <button
              type="button"
              onClick={() => setModifying(false)}
              className="text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
          <p className="text-sm text-ink-muted">
            This saves a new run linked to the original. Playback stays on
            this replay until you select that variant.
          </p>
          <BacktestQueueForm
            templates={[]}
            seed={seed}
            loadedFromRun
            variantParentId={rootId}
            onVariantPending={() => {
              if (pendingToken.current) {
                clearOptimisticVariant(pendingToken.current);
              }
              pendingToken.current = beginOptimisticVariant();
            }}
            onVariantFailed={() => {
              if (pendingToken.current) {
                clearOptimisticVariant(pendingToken.current);
                pendingToken.current = null;
              }
            }}
            onVariantQueued={(runId) => {
              if (pendingToken.current) {
                resolveOptimisticVariant(pendingToken.current, runId);
                pendingToken.current = null;
              }
              setModifying(false);
              router.refresh();
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Parameters</h2>
            <button
              type="button"
              onClick={() => setModifying(true)}
              className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent"
            >
              Modify
            </button>
          </div>
          <BacktestPropertyList rows={paramRows} />
          {variant && run.status === "done" ? (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                Keep
              </p>
              <SaveBacktestAsTemplateButton
                runId={run.id}
                defaultName={backtestRunTitle(run)}
                deskType={run.deskType}
                folders={folders}
                canSaveAs={allowKeep}
                canSaveAsPlatform={false}
              />
              {allowKeepPlatform ? (
                <SaveBacktestAsTemplateButton
                  runId={run.id}
                  defaultName={backtestRunTitle(run)}
                  deskType={run.deskType}
                  folders={folders}
                  canSaveAs={false}
                  canSaveAsPlatform
                  variant="secondary"
                />
              ) : null}
              <ApplyBacktestButton
                runId={run.id}
                defaultName={backtestRunTitle(run)}
                desks={applyDesks}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function RailButton({
  label,
  pressed,
  onClick,
  icon,
  badge = 0,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  icon: ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      aria-label={badge > 0 ? `${label}, ${badge} running` : label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`relative inline-flex flex-1 items-center justify-center lg:h-11 lg:flex-none ${
        pressed
          ? "bg-surface-raised text-accent"
          : "text-ink-muted hover:bg-surface-raised hover:text-ink"
      }`}
    >
      {icon}
      {badge > 0 ? (
        <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold leading-4 text-ink">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function variantSummary(root: BacktestRun, row: BacktestRun): string {
  return backtestVariantChangeLabel(root, row) || backtestRunTitle(row);
}

export function ReplayVariantSelect({
  run,
  family,
  rootId,
}: {
  run: BacktestRun;
  family: BacktestRun[];
  rootId: string;
}) {
  const root = family.find((row) => row.id === rootId) ?? run;
  const variants = family
    .filter((row) => row.id !== rootId)
    .slice()
    .sort((left, right) => left.createdAtMs - right.createdAtMs);
  const optimistic = useOptimisticVariants();
  const known = new Set(family.map((row) => row.id));
  const waiting = optimistic.filter(
    (row) => row.runId == null || !known.has(row.runId),
  );
  const pending =
    waiting.length > 0 ||
    variants.some((row) => row.status === "queued" || row.status === "running");
  const selected =
    run.id === rootId ? "Original" : variantSummary(root, run);
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const primed = useRef(false);
  const seenPending = useRef<Set<string>>(new Set());
  const seenOptimistic = useRef<Set<string>>(new Set());

  useEffect(() => {
    const base = family.find((row) => row.id === rootId) ?? run;
    const pendingIds = new Set(
      family
        .filter(
          (row) =>
            row.id !== rootId &&
            (row.status === "queued" || row.status === "running"),
        )
        .map((row) => row.id),
    );
    const optimisticIds = new Set(
      optimistic
        .map((row) => row.runId)
        .filter((id): id is string => id != null),
    );
    const doneIds = new Set(
      family
        .filter((row) => row.id !== rootId && row.status === "done")
        .map((row) => row.id),
    );
    const justDone = completedBacktestVariantIds({
      primed: primed.current,
      previousPendingIds: seenPending.current,
      previousOptimisticIds: seenOptimistic.current,
      pendingIds,
      optimisticIds,
      doneIds,
    });
    primed.current = true;
    seenPending.current = pendingIds;
    seenOptimistic.current = optimisticIds;
    if (justDone.length === 1) {
      const row = family.find((item) => item.id === justDone[0]);
      setFinished(
        row ? `${variantSummary(base, row)} finished.` : "Backtest finished.",
      );
    } else if (justDone.length > 1) {
      setFinished(`${justDone.length} backtests finished.`);
    }
  }, [family, optimistic, rootId, run]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex min-w-0 shrink items-center gap-2">
      <div ref={menuRef} className="relative min-w-0">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={pending ? "Backtest variant, pending" : "Backtest variant"}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex max-w-64 items-center gap-2 rounded-control border border-line bg-canvas px-3 py-1.5 text-left text-sm text-ink hover:border-line-strong"
        >
          <span className="min-w-0 truncate">{selected}</span>
          {pending ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-warning">
              <IconLoader className="size-3.5 animate-spin" />
              Pending
            </span>
          ) : null}
          <IconChevronDown className="size-4 shrink-0 text-ink-muted" />
        </button>
        {open ? (
          <ul
            role="listbox"
            aria-label="Backtest variants"
            className="absolute left-0 top-full z-40 mt-1 max-h-80 w-72 overflow-auto rounded-card border border-line bg-surface py-1"
          >
            <VariantOption
              href={`/account/backtests/${rootId}/replay`}
              label="Original"
              selected={run.id === rootId}
              onChoose={() => setOpen(false)}
            />
            {waiting.map((row) => (
              <li key={row.token} className="px-3 py-2">
                <span className="flex items-center justify-between gap-2 text-sm text-ink">
                  New backtest
                  <span className="inline-flex items-center gap-1 text-xs text-warning">
                    <IconLoader className="size-3.5 animate-spin" />
                    Pending
                  </span>
                </span>
              </li>
            ))}
            {variants.map((row) => {
              const active = row.status === "queued" || row.status === "running";
              const label = variantSummary(root, row);
              if (row.status !== "done") {
                return (
                  <li key={row.id} className="px-3 py-2">
                    <span className="flex items-center justify-between gap-2 text-sm text-ink">
                      <span className="min-w-0 truncate">{label}</span>
                      {active ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-warning">
                          <IconLoader className="size-3.5 animate-spin" />
                          Pending
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs capitalize text-danger">
                          {row.status}
                        </span>
                      )}
                    </span>
                    {row.status === "failed" && row.error ? (
                      <span className="mt-1 block text-xs text-danger">
                        {row.error}
                      </span>
                    ) : null}
                  </li>
                );
              }
              return (
                <VariantOption
                  key={row.id}
                  href={`/account/backtests/${row.id}/replay`}
                  label={label}
                  selected={run.id === row.id}
                  onChoose={() => setOpen(false)}
                />
              );
            })}
          </ul>
        ) : null}
      </div>
      {finished ? (
        <p className="flex max-w-64 items-center gap-2 text-sm text-success">
          <span>{finished}</span>
          <button
            type="button"
            aria-label="Dismiss finished notice"
            onClick={() => setFinished(null)}
            className="text-ink-muted hover:text-ink"
          >
            Dismiss
          </button>
        </p>
      ) : null}
    </div>
  );
}

function VariantOption({
  href,
  label,
  selected,
  onChoose,
}: {
  href: string;
  label: string;
  selected: boolean;
  onChoose: () => void;
}) {
  return (
    <li role="option" aria-selected={selected}>
      <Link
        href={href}
        onClick={onChoose}
        className={`block truncate px-3 py-2 text-sm hover:bg-surface-raised ${
          selected ? "bg-surface-raised text-ink" : "text-ink"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}

export function ReplayVariantWatcher({
  family,
  rootId,
}: {
  family: BacktestRun[];
  rootId: string;
}) {
  const router = useRouter();
  const nudged = useRef(new Set<string>());
  const optimistic = useOptimisticVariants();

  useEffect(() => {
    dropCoveredOptimisticVariants(new Set(family.map((row) => row.id)));
  }, [family]);

  useEffect(() => {
    const pending = family.filter(
      (row) =>
        row.id !== rootId &&
        (row.status === "queued" || row.status === "running"),
    );
    const known = new Set(family.map((row) => row.id));
    const waiting = optimistic.some(
      (row) => row.runId == null || !known.has(row.runId),
    );
    if (pending.length === 0 && !waiting) {
      return;
    }
    for (const row of pending) {
      if (row.status !== "queued" || nudged.current.has(row.id)) {
        continue;
      }
      nudged.current.add(row.id);
      void nudgeBacktestRunAction(row.id).finally(() => {
        router.refresh();
      });
    }
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        router.refresh();
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [family, optimistic, rootId, router]);

  return null;
}

export function useUnresolvedOptimisticCount(runIds: readonly string[]): number {
  const optimistic = useOptimisticVariants();
  const known = new Set(runIds);
  return optimistic.filter((row) => row.runId == null || !known.has(row.runId))
    .length;
}
