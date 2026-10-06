"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconStar, IconStarFilled } from "@/components/icons";
import {
  REPLAY_INTERVAL_ROW_DEFAULTS,
  replayIntervalRow,
} from "@/lib/backtest/replay-preferences";
import {
  DCA_INDICATOR_TIMEFRAMES,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

const ROW_DEFAULTS = new Set<string>(REPLAY_INTERVAL_ROW_DEFAULTS);

const INTERVAL_GROUPS: { label: string; intervals: DcaIndicatorTimeframe[] }[] = [
  {
    label: "Minutes",
    intervals: DCA_INDICATOR_TIMEFRAMES.filter((row) => row !== "D" && Number(row) < 60),
  },
  {
    label: "Hours",
    intervals: DCA_INDICATOR_TIMEFRAMES.filter((row) => Number(row) >= 60),
  },
  {
    label: "Days",
    intervals: DCA_INDICATOR_TIMEFRAMES.filter((row) => row === "D"),
  },
];

export function ReplayChartIntervalControl({
  interval,
  onInterval,
  favorites,
  onFavorites,
}: {
  interval: DcaIndicatorTimeframe;
  onInterval: (value: DcaIndicatorTimeframe) => void;
  favorites: readonly DcaIndicatorTimeframe[];
  onFavorites: (value: DcaIndicatorTimeframe[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const row = replayIntervalRow(favorites, interval);
  const favoriteSet = new Set<string>(favorites);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggleFavorite(value: DcaIndicatorTimeframe) {
    if (ROW_DEFAULTS.has(value)) {
      return;
    }
    onFavorites(
      favoriteSet.has(value)
        ? favorites.filter((rowId) => rowId !== value)
        : [...favorites, value],
    );
  }

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-1">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Chart timeframe">
        {row.map((value) => {
          const selected = interval === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onInterval(value)}
              className={`rounded-control px-2 py-1 text-xs ${
                selected
                  ? "bg-accent-strong text-ink"
                  : "border border-line text-ink-muted hover:text-ink"
              }`}
            >
              {DCA_INDICATOR_TIMEFRAME_LABELS[value]}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={`inline-flex size-7 items-center justify-center rounded-control border border-line hover:text-ink ${
          open ? "text-ink" : "text-ink-muted"
        }`}
        aria-label="Timeframes"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Timeframes"
        onClick={() => setOpen((current) => !current)}
      >
        <IconChevronDown size={14} className={`size-3.5 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Chart timeframes"
          className="absolute left-0 top-full z-30 mt-1 w-56 rounded-card border border-line bg-surface p-1"
        >
          {INTERVAL_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-[0.12em] text-ink-muted">
                {group.label}
              </p>
              {group.intervals.map((value) => {
                const label = DCA_INDICATOR_TIMEFRAME_LABELS[value];
                const selected = interval === value;
                const locked = ROW_DEFAULTS.has(value);
                const pinned = locked || favoriteSet.has(value);
                return (
                  <div
                    key={value}
                    className={`flex items-center rounded-control ${
                      selected ? "bg-accent/15" : "hover:bg-surface-raised"
                    }`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="min-w-0 flex-1 px-3 py-1.5 text-left text-sm text-ink"
                      onClick={() => {
                        onInterval(value);
                        setOpen(false);
                      }}
                    >
                      {label}
                    </button>
                    <button
                      type="button"
                      aria-pressed={pinned}
                      aria-label={
                        locked
                          ? `${label} stays on the chart bar`
                          : pinned
                            ? `Remove ${label} from the chart bar`
                            : `Show ${label} on the chart bar`
                      }
                      title={locked ? "Always on the chart bar" : pinned ? "Remove from the chart bar" : "Show on the chart bar"}
                      className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:text-ink"
                      onClick={() => toggleFavorite(value)}
                    >
                      {pinned ? (
                        <IconStarFilled size={14} className="size-3.5 text-ink" />
                      ) : (
                        <IconStar size={14} className="size-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
