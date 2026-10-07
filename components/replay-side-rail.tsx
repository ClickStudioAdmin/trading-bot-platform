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
  IconLoader,
  IconPerformance,
  IconPlay,
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
import { backtestVariantChangeLabel } from "@/lib/backtest/variant-label";
import type { AutomationTemplateSet } from "@/lib/templates/store";

const RAIL_KEY = "tbp-replay-rail";
const RAIL_EVENT = "tbp-replay-rail";

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
  family,
  rootId,
  positions,
  playbackStats,
  allowKeep,
  allowKeepPlatform,
  folders,
  applyDesks,
}: {
  panel: Exclude<ReplayRailPanel, "closed">;
  run: BacktestRun;
  family: BacktestRun[];
  rootId: string;
  positions: ReactNode;
  playbackStats: ReactNode;
  allowKeep: boolean;
  allowKeepPlatform: boolean;
  folders: AutomationTemplateSet[];
  applyDesks: Array<{ id: string; name: string }>;
}) {
  if (panel === "positions") {
    return <div className="min-h-0 flex-1 overflow-auto">{positions}</div>;
  }
  if (panel === "statistics") {
    return (
      <div className="min-h-0 flex-1 space-y-6 overflow-auto p-4">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Through the playhead</h2>
          {playbackStats}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Full run</h2>
          <BacktestStatsGrid run={run} />
        </section>
      </div>
    );
  }
  return (
    <ParametersBody
      run={run}
      family={family}
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
  family,
  rootId,
  allowKeep,
  allowKeepPlatform,
  folders,
  applyDesks,
}: {
  run: BacktestRun;
  family: BacktestRun[];
  rootId: string;
  allowKeep: boolean;
  allowKeepPlatform: boolean;
  folders: AutomationTemplateSet[];
  applyDesks: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const nudged = useRef(new Set<string>());
  const [modifying, setModifying] = useState(false);
  const root = family.find((row) => row.id === rootId) ?? run;
  const variants = family
    .filter((row) => row.id !== rootId)
    .slice()
    .sort((left, right) => left.createdAtMs - right.createdAtMs);
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

  useEffect(() => {
    const pending = family.filter(
      (row) =>
        row.id !== rootId &&
        (row.status === "queued" || row.status === "running"),
    );
    if (pending.length === 0) {
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
  }, [family, rootId, router]);

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
      {run.id !== rootId ? (
        <Link
          href={`/account/backtests/${rootId}/replay`}
          onClick={() => writeRail("parameters")}
          className="text-sm text-accent hover:underline"
        >
          Back to original
        </Link>
      ) : null}
      <VariantList
        root={root}
        variants={variants}
        screenId={run.id}
        allowKeep={allowKeep}
        allowKeepPlatform={allowKeepPlatform}
        folders={folders}
        applyDesks={applyDesks}
      />
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
            this replay until you choose Play.
          </p>
          <BacktestQueueForm
            templates={[]}
            seed={seed}
            loadedFromRun
            variantParentId={rootId}
            onVariantQueued={() => {
              setModifying(false);
              writeRail("parameters");
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

function VariantList({
  root,
  variants,
  screenId,
  allowKeep,
  allowKeepPlatform,
  folders,
  applyDesks,
}: {
  root: BacktestRun;
  variants: BacktestRun[];
  screenId: string;
  allowKeep: boolean;
  allowKeepPlatform: boolean;
  folders: AutomationTemplateSet[];
  applyDesks: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">Variants</h3>
      <ul className="space-y-2">
        <VariantRow
          row={root}
          summary="Original"
          screenId={screenId}
          allowKeep={allowKeep}
          allowKeepPlatform={allowKeepPlatform}
          folders={folders}
          applyDesks={applyDesks}
        />
        {variants.map((row) => (
          <VariantRow
            key={row.id}
            row={row}
            summary={backtestVariantChangeLabel(root, row)}
            screenId={screenId}
            allowKeep={allowKeep}
            allowKeepPlatform={allowKeepPlatform}
            folders={folders}
            applyDesks={applyDesks}
          />
        ))}
      </ul>
      {variants.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No variants yet. Modify to run one in the background.
        </p>
      ) : null}
    </div>
  );
}

function VariantRow({
  row,
  summary,
  screenId,
  allowKeep,
  allowKeepPlatform,
  folders,
  applyDesks,
}: {
  row: BacktestRun;
  summary: string;
  screenId: string;
  allowKeep: boolean;
  allowKeepPlatform: boolean;
  folders: AutomationTemplateSet[];
  applyDesks: Array<{ id: string; name: string }>;
}) {
  const onScreen = row.id === screenId;
  const active = row.status === "queued" || row.status === "running";
  const done = row.status === "done";
  const realized = row.stats ? signedMoney(row.stats.realizedUsdt) : null;
  return (
    <li className="rounded-control border border-line bg-canvas p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{summary}</p>
        {active ? (
          <IconLoader className="size-4 shrink-0 animate-spin text-warning" />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {row.status}
        {realized ? ` · ${realized}` : ""}
      </p>
      {row.status === "failed" && row.error ? (
        <p className="mt-1 text-xs text-danger">{row.error}</p>
      ) : null}
      {done ? (
        <div className="mt-2 space-y-2">
          {onScreen ? (
            <p className="text-xs text-success">On screen</p>
          ) : (
            <Link
              href={`/account/backtests/${row.id}/replay`}
              onClick={() => writeRail("parameters")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <IconPlay className="size-4 fill-current" />
              Play
            </Link>
          )}
          {onScreen ? null : (
            <>
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                Keep
              </p>
              <SaveBacktestAsTemplateButton
                runId={row.id}
                defaultName={backtestRunTitle(row)}
                deskType={row.deskType}
                folders={folders}
                canSaveAs={allowKeep}
                canSaveAsPlatform={false}
              />
              {allowKeepPlatform ? (
                <SaveBacktestAsTemplateButton
                  runId={row.id}
                  defaultName={backtestRunTitle(row)}
                  deskType={row.deskType}
                  folders={folders}
                  canSaveAs={false}
                  canSaveAsPlatform
                  variant="secondary"
                />
              ) : null}
              <ApplyBacktestButton
                runId={row.id}
                defaultName={backtestRunTitle(row)}
                desks={applyDesks}
              />
            </>
          )}
        </div>
      ) : null}
    </li>
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
