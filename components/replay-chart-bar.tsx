"use client";

import { useState, type ReactNode } from "react";
import { BacktestChartIntervalBar } from "@/components/backtest-chart-interval";
import {
  ChartScreenshotControls,
  type ChartSnapshot,
} from "@/components/chart-screenshot";
import { IconChartBars, IconClose, IconPalette } from "@/components/icons";
import {
  REPLAY_BAR_FIELDS,
  REPLAY_CANVAS_FIELDS,
  type ReplayChartAppearance,
  type ReplayChartAppearancePatch,
} from "@/lib/backtest/chart-appearance";
import {
  INDICATOR_STYLE_COLORS,
  type IndicatorStyleColor,
} from "@/lib/backtest/indicator-style";
import type { BacktestRun } from "@/lib/backtest/model";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";

const SWATCH: Record<IndicatorStyleColor, string> = {
  accent: "bg-accent",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
  "ink-muted": "bg-ink-muted",
  "ink-faint": "bg-ink-faint",
};

const TOOL_BUTTON =
  "inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink";

export function ReplayChartBar({
  run,
  interval,
  onInterval,
  appearance,
  onChange,
  onSave,
  onReset,
  getChart,
  screenshotName,
}: {
  run: BacktestRun;
  interval: DcaIndicatorTimeframe;
  onInterval: (value: DcaIndicatorTimeframe) => void;
  appearance: ReplayChartAppearance;
  onChange: (patch: ReplayChartAppearancePatch) => void;
  onSave: (fields: readonly (keyof ReplayChartAppearance)[]) => void;
  onReset: (fields: readonly (keyof ReplayChartAppearance)[]) => void;
  getChart: () => ChartSnapshot | null;
  screenshotName: string;
}) {
  const [open, setOpen] = useState<"bars" | "canvas" | null>(null);
  return (
    <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-line px-2 py-1">
      <BacktestChartIntervalBar run={run} interval={interval} onChange={onInterval} />
      <div className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          className={TOOL_BUTTON}
          aria-label="Bar settings"
          aria-expanded={open === "bars"}
          title="Bar settings"
          onClick={() => setOpen((current) => (current === "bars" ? null : "bars"))}
        >
          <IconChartBars size={16} className="size-4" />
        </button>
        <button
          type="button"
          className={TOOL_BUTTON}
          aria-label="Canvas styles"
          aria-expanded={open === "canvas"}
          title="Canvas styles"
          onClick={() => setOpen((current) => (current === "canvas" ? null : "canvas"))}
        >
          <IconPalette size={16} className="size-4" />
        </button>
        <ChartScreenshotControls getChart={getChart} filename={screenshotName} />
      </div>
      {open === "bars" ? (
        <Panel title="Bar settings" onClose={() => setOpen(null)}>
          <ColorRow
            label="Up"
            value={appearance.up}
            onChange={(up) => onChange({ up })}
          />
          <ColorRow
            label="Down"
            value={appearance.down}
            onChange={(down) => onChange({ down })}
          />
          <p className="text-xs text-ink-faint">Wicks use the body colour.</p>
          <PanelActions
            onSave={() => onSave(REPLAY_BAR_FIELDS)}
            onReset={() => onReset(REPLAY_BAR_FIELDS)}
          />
        </Panel>
      ) : null}
      {open === "canvas" ? (
        <Panel title="Canvas styles" onClose={() => setOpen(null)}>
          <ColorRow
            label="Background"
            value={appearance.background}
            onChange={(background) => onChange({ background })}
          />
          <ColorRow
            label="Grid"
            value={appearance.grid}
            onChange={(grid) => onChange({ grid })}
          />
          <label className="block text-xs text-ink">
            Grid opacity
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={appearance.gridOpacity}
              aria-valuetext={`${appearance.gridOpacity}%`}
              className="mt-1 w-full accent-accent"
              onChange={(event) => onChange({ gridOpacity: Number(event.target.value) })}
            />
          </label>
          <p className="text-xs text-ink-faint">{appearance.gridOpacity}%</p>
          <PanelActions
            onSave={() => onSave(REPLAY_CANVAS_FIELDS)}
            onReset={() => onReset(REPLAY_CANVAS_FIELDS)}
          />
        </Panel>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute right-2 top-full z-30 mt-1 w-80 rounded-card border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <IconClose size={16} className="size-4" />
        </button>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: IndicatorStyleColor | null;
  onChange: (value: IndicatorStyleColor | null) => void;
}) {
  return (
    <div>
      <p className="text-xs text-ink">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label={`${label} colour`}>
        <Swatch
          label="Default"
          selected={value == null}
          className="bg-surface-raised"
          onClick={() => onChange(null)}
        />
        {INDICATOR_STYLE_COLORS.map((swatch) => (
          <Swatch
            key={swatch.id}
            label={swatch.label}
            selected={value === swatch.id}
            className={SWATCH[swatch.id]}
            onClick={() => onChange(swatch.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Swatch({
  label,
  selected,
  className,
  onClick,
}: {
  label: string;
  selected: boolean;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={`size-4 rounded-full border ${selected ? "border-ink" : "border-line"} ${className}`}
      onClick={onClick}
    />
  );
}

function PanelActions({ onSave, onReset }: { onSave: () => void; onReset: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="rounded-control border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink"
        onClick={onSave}
      >
        Save as global
      </button>
      <button
        type="button"
        className="rounded-control border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink"
        onClick={onReset}
      >
        Reset to default
      </button>
    </div>
  );
}
