"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { BacktestQueueForm } from "@/components/backtest-queue-form";
import { useConfirmDialog } from "@/components/confirm-modal";
import {
  ApplyBacktestButton,
  BacktestParameterSections,
  BacktestStatsGrid,
  SaveBacktestAsTemplateButton,
} from "@/components/backtest-run-view";
import {
  IconActivity,
  IconChevronDown,
  IconClose,
  IconLoader,
  IconPerformance,
  IconPlay,
  IconPositions,
  IconTrash,
} from "@/components/icons";
import {
  deleteBacktestAction,
  nudgeBacktestRunAction,
  pollReplayFamilyAction,
} from "@/lib/backtest/actions";
import { backtestListedSections } from "@/lib/backtest/param-sections";
import {
  backtestQueueSeedFromRun,
  backtestRunTitle,
  type BacktestRun,
} from "@/lib/backtest/model";
import {
  completedBacktestVariantIds,
  mergeReplayVariantRows,
  sameReplayVariantRows,
  type ReplayVariantRow,
} from "@/lib/backtest/variant-label";
import type { AutomationTemplateSet } from "@/lib/templates/store";

const RAIL_KEY = "tbp-replay-rail-v2";
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

type FamilyPoll = { rootId: string; rows: ReplayVariantRow[] };

let familyPoll: FamilyPoll | null = null;
const familyPollListeners = new Set<() => void>();

function publishFamilyPoll(next: FamilyPoll) {
  if (
    familyPoll &&
    familyPoll.rootId === next.rootId &&
    sameReplayVariantRows(familyPoll.rows, next.rows)
  ) {
    return;
  }
  familyPoll = next;
  for (const listener of familyPollListeners) {
    listener();
  }
}

function subscribeFamilyPoll(onStoreChange: () => void) {
  familyPollListeners.add(onStoreChange);
  return () => familyPollListeners.delete(onStoreChange);
}

function familyPollSnapshot(): FamilyPoll | null {
  return familyPoll;
}

function familyRows(family: BacktestRun[]): ReplayVariantRow[] {
  return family.map((row) => ({
    id: row.id,
    status: row.status,
    name: row.recipe.name.trim() || "Backtest",
    error: row.error,
    createdAtMs: row.createdAtMs,
  }));
}

export function useReplayVariantRows(
  rootId: string,
  family: BacktestRun[],
): ReplayVariantRow[] {
  const poll = useSyncExternalStore(
    subscribeFamilyPoll,
    familyPollSnapshot,
    () => null,
  );
  const base = useMemo(() => familyRows(family), [family]);
  return useMemo(() => {
    if (!poll || poll.rootId !== rootId) {
      return base;
    }
    return mergeReplayVariantRows(base, poll.rows);
  }, [base, poll, rootId]);
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
  return "parameters";
}

function railServerSnapshot(): ReplayRailPanel {
  return "parameters";
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
        label="Parameters"
        pressed={panel === "parameters"}
        onClick={() => selectReplayRail("parameters", panel)}
        badge={runningCount}
        icon={<IconActivity className="size-5" />}
      />
      <RailButton
        label="Positions"
        pressed={panel === "positions"}
        onClick={() => selectReplayRail("positions", panel)}
        icon={<IconPositions className="size-5" />}
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
      <div className="h-full min-h-0 flex-1 overflow-auto">
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
  const paramSections = backtestListedSections(run.recipe, {
    leverage: run.leverage,
    startingUsdt: run.startingUsdt,
    fromMs: run.fromMs,
    toMs: run.toMs,
  });

  return (
    <div
      className={`h-full min-h-0 flex-1 overflow-auto ${
        modifying ? "" : "space-y-4 p-4"
      }`}
    >
      {modifying ? (
          <BacktestQueueForm
            templates={[]}
            seed={seed}
            loadedFromRun
            variantParentId={rootId}
            onVariantCancel={() => setModifying(false)}
            variantLeading={
              <p className="text-sm text-ink-muted">
                This saves a new run linked to the original. Playback stays on
                this replay until you select that variant.
              </p>
            }
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
          <BacktestParameterSections sections={paramSections} />
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

function variantName(row: BacktestRun): string {
  return row.recipe.name.trim() || "Backtest";
}

type FinishedNotice = {
  text: string;
  playLabel: string;
  runId: string;
};

export function ReplayVariantSelect({
  run,
  family,
  rootId,
  onBeforeNavigate,
  onPlayHere,
}: {
  run: BacktestRun;
  family: BacktestRun[];
  rootId: string;
  onBeforeNavigate?: () => void;
  onPlayHere?: () => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const rows = useReplayVariantRows(rootId, family);
  const variants = rows
    .filter((row) => row.id !== rootId)
    .slice()
    .sort((left, right) => left.createdAtMs - right.createdAtMs);
  const optimistic = useOptimisticVariants();
  const known = new Set(rows.map((row) => row.id));
  const waiting = optimistic.filter(
    (row) => row.runId == null || !known.has(row.runId),
  );
  const pending =
    waiting.length > 0 ||
    variants.some((row) => row.status === "queued" || row.status === "running");
  const selected =
    run.id === rootId
      ? "Original"
      : (rows.find((row) => row.id === run.id)?.name ?? variantName(run));
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState<FinishedNotice | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const primed = useRef(false);
  const seenPending = useRef<Set<string>>(new Set());
  const seenOptimistic = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pendingIds = new Set(
      rows
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
      rows
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
      const row = rows.find((item) => item.id === justDone[0]);
      const name = row?.name || "Backtest";
      setFinished({
        text: `${name} finished.`,
        playLabel: `Play ${name}`,
        runId: justDone[0] ?? "",
      });
    } else if (justDone.length > 1) {
      const runId = justDone[justDone.length - 1] ?? "";
      setFinished({
        text: `${justDone.length} backtests finished.`,
        playLabel: "Play the latest finished backtest",
        runId,
      });
    }
  }, [optimistic, rootId, rows]);

  async function removeVariant(row: ReplayVariantRow) {
    const name = row.name;
    const ok = await confirm({
      title: `Delete ${name}?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) {
      return;
    }
    setDeletingId(row.id);
    setDeleteError(null);
    const data = new FormData();
    data.set("runId", row.id);
    const result = await deleteBacktestAction(data);
    setDeletingId(null);
    if (!result.ok) {
      setDeleteError(result.error ?? "Could not delete that backtest.");
      return;
    }
    setOpen(false);
    if (run.id === row.id) {
      router.push(`/account/backtests/${rootId}/replay`);
    }
    router.refresh();
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    function place() {
      const node = buttonRef.current;
      if (!node) {
        return;
      }
      const rect = node.getBoundingClientRect();
      setMenuBox({ top: rect.bottom + 4, left: rect.left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function openVariant(href: string, selected: boolean) {
    if (selected) {
      setOpen(false);
      return;
    }
    onBeforeNavigate?.();
    window.location.assign(href);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
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
      {dialog}
      <div className="relative min-w-0">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={pending ? "Backtest variant, pending" : "Backtest variant"}
          title={selected}
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
        {open && menuBox
          ? createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            aria-label="Backtest variants"
            className="fixed z-[80] max-h-80 w-80 overflow-auto rounded-card border border-line bg-surface py-1"
            style={{ top: menuBox.top, left: menuBox.left }}
          >
            <VariantOption
              href={`/account/backtests/${rootId}/replay`}
              label="Original"
              selected={run.id === rootId}
              onOpen={() => openVariant(`/account/backtests/${rootId}/replay`, run.id === rootId)}
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
              const label = row.name;
              const remove = (
                <VariantDeleteButton
                  label={label}
                  pending={deletingId === row.id}
                  onDelete={() => void removeVariant(row)}
                />
              );
              if (row.status !== "done") {
                return (
                  <li key={row.id} className="px-3 py-2">
                    <span className="flex items-center justify-between gap-2 text-sm text-ink">
                      <span className="min-w-0 truncate" title={label}>
                        {label}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        {active ? (
                          <span className="inline-flex items-center gap-1 text-xs text-warning">
                            <IconLoader className="size-3.5 animate-spin" />
                            Pending
                          </span>
                        ) : (
                          <span className="text-xs capitalize text-danger">
                            {row.status}
                          </span>
                        )}
                        {remove}
                      </span>
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
                  onOpen={() =>
                    openVariant(
                      `/account/backtests/${row.id}/replay`,
                      run.id === row.id,
                    )
                  }
                  trailing={remove}
                />
              );
            })}
            {deleteError ? (
              <li className="px-3 py-2 text-xs text-danger">{deleteError}</li>
            ) : null}
          </ul>,
          document.body,
        )
          : null}
      </div>
      {finished ? (
        <div
          role="status"
          className="inline-flex min-w-0 max-w-72 items-center rounded-control border border-success/40 bg-success/15 text-sm text-success"
        >
          <button
            type="button"
            title={finished.playLabel}
            aria-label={finished.playLabel}
            onClick={() => {
              if (finished.runId === run.id) {
                onPlayHere?.();
                setFinished(null);
                return;
              }
              openVariant(
                `/account/backtests/${finished.runId}/replay`,
                false,
              );
            }}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-control py-1 pl-2 pr-1.5 hover:bg-success/20"
          >
            <IconPlay size={14} className="size-3.5 shrink-0 fill-current" />
            <span className="truncate">{finished.text}</span>
          </button>
          <button
            type="button"
            aria-label="Dismiss finished notice"
            onClick={() => setFinished(null)}
            className="mr-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-control hover:bg-success/20"
          >
            <IconClose size={14} className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function variantClickModified(event: ReactMouseEvent<HTMLAnchorElement>) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function VariantOption({
  href,
  label,
  selected,
  onOpen,
  trailing,
}: {
  href: string;
  label: string;
  selected: boolean;
  onOpen: () => void;
  trailing?: ReactNode;
}) {
  return (
    <li
      role="option"
      aria-selected={selected}
      className={`flex items-center gap-1 pr-1 ${
        selected ? "bg-surface-raised" : ""
      }`}
    >
      <a
        href={href}
        title={label}
        onMouseDown={(event) => {
          if (variantClickModified(event)) {
            return;
          }
          event.preventDefault();
          onOpen();
        }}
        onClick={(event) => {
          if (variantClickModified(event)) {
            return;
          }
          event.preventDefault();
          onOpen();
        }}
        className="min-w-0 flex-1 truncate px-3 py-2 text-sm text-ink hover:bg-surface-raised"
      >
        {label}
      </a>
      {trailing}
    </li>
  );
}

function VariantDeleteButton({
  label,
  pending,
  onDelete,
}: {
  label: string;
  pending: boolean;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Delete ${label}`}
      title="Delete"
      disabled={pending}
      onClick={onDelete}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-danger disabled:opacity-40"
    >
      <IconTrash className="size-3.5" />
    </button>
  );
}

export function ReplayVariantWatcher({
  family,
  rootId,
}: {
  family: BacktestRun[];
  rootId: string;
}) {
  const nudged = useRef(new Set<string>());
  const optimistic = useOptimisticVariants();
  const rows = useReplayVariantRows(rootId, family);

  useEffect(() => {
    dropCoveredOptimisticVariants(new Set(rows.map((row) => row.id)));
  }, [rows]);

  useEffect(() => {
    const pending = rows.filter(
      (row) =>
        row.id !== rootId &&
        (row.status === "queued" || row.status === "running"),
    );
    const known = new Set(rows.map((row) => row.id));
    const waiting = optimistic.some(
      (row) => row.runId == null || !known.has(row.runId),
    );
    if (pending.length === 0 && !waiting) {
      return;
    }
    let cancelled = false;
    async function poll() {
      const result = await pollReplayFamilyAction(rootId);
      if (cancelled || !result.ok) {
        return;
      }
      flushSync(() => {
        publishFamilyPoll({ rootId, rows: result.rows });
      });
    }
    for (const row of pending) {
      if (row.status !== "queued" || nudged.current.has(row.id)) {
        continue;
      }
      nudged.current.add(row.id);
      void nudgeBacktestRunAction(row.id).finally(() => {
        void poll();
      });
    }
    void poll();
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void poll();
      }
    }, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [optimistic, rootId, rows]);

  return null;
}

export function useUnresolvedOptimisticCount(runIds: readonly string[]): number {
  const optimistic = useOptimisticVariants();
  const known = new Set(runIds);
  return optimistic.filter((row) => row.runId == null || !known.has(row.runId))
    .length;
}
