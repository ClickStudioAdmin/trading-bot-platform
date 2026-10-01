"use client";

import { useState } from "react";
import { ChartColorPicker } from "@/components/chart-color-picker";
import { IconChevronDown, IconClose, IconUiPrefs } from "@/components/icons";
import type { ReplayIndicatorLegendRow } from "@/lib/backtest/chart-series";
import type { IndicatorStyleTarget } from "@/lib/backtest/chart-series";
import { colorWithOpacity } from "@/lib/backtest/chart-appearance";
import {
  indicatorLineStyle,
  type IndicatorLineStyle,
  type IndicatorStyleMap,
} from "@/lib/backtest/indicator-style";

export function ReplayIndicatorLegend({
  rows,
  targets,
  names,
  session,
  saved,
  onChange,
  onSaveGlobal,
  onReset,
}: {
  rows: ReplayIndicatorLegendRow[];
  targets: Record<string, IndicatorStyleTarget[]>;
  names: Record<string, string>;
  session: IndicatorStyleMap;
  saved: IndicatorStyleMap;
  onChange: (layerId: string, lineId: string, style: IndicatorLineStyle) => void;
  onSaveGlobal: (layerId: string) => void;
  onReset: (layerId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shown, setShown] = useState(true);
  const openTargets = openId ? targets[openId] : null;
  return (
    <>
      <div
        className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[70%] flex-col"
        aria-label="Active indicators"
      >
        {shown ? rows.map((row) => (
          <div key={row.id} className="flex items-start gap-1">
            <button
              type="button"
              className="pointer-events-auto mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-control text-ink-faint hover:bg-surface-raised hover:text-ink"
              aria-label={`Style ${row.name}`}
              aria-expanded={openId === row.id}
              onClick={() => setOpenId((current) => (current === row.id ? null : row.id))}
            >
              <IconUiPrefs size={12} className="size-3" />
            </button>
            <p className="text-[11px] leading-4 text-ink-muted [text-shadow:0_1px_1px_var(--color-canvas),0_0_2px_var(--color-canvas)]">
              {row.name}
              {row.values.flatMap((value) => {
                const style = indicatorLineStyle(session, saved, row.id, value.id);
                if (!style.visible) {
                  return [];
                }
                return [{ id: value.id, color: legendPaint(style, value.color), text: value.text }];
              }).map((value, index) => (
                <span key={value.id} style={{ color: value.color }}>
                  {index === 0 ? " - " : ", "}
                  {value.text}
                </span>
              ))}
            </p>
          </div>
        )) : null}
        <button
          type="button"
          className="pointer-events-auto mt-1 inline-flex size-6 items-center justify-center rounded-control border border-line-strong bg-surface text-ink hover:bg-surface-raised"
          aria-expanded={shown}
          aria-label={shown ? "Hide indicators" : "Show indicators"}
          onClick={() => {
            setShown((current) => !current);
            setOpenId(null);
          }}
        >
          <IconChevronDown
            size={16}
            strokeWidth={2.25}
            className={`size-4 ${shown ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {shown && openId && openTargets ? (
        <div
          className="absolute left-14 top-2 z-30 w-80 rounded-card border border-line bg-surface p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{names[openId] ?? "Indicator"}</p>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
              aria-label="Close style"
              onClick={() => setOpenId(null)}
            >
              <IconClose size={16} className="size-4" />
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {openTargets.map((line) => {
              const style = indicatorLineStyle(session, saved, openId, line.id);
              return (
                <div key={line.id}>
                  <label className="flex items-center gap-2 text-xs text-ink">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={style.visible}
                      onChange={(event) =>
                        onChange(openId, line.id, { ...style, visible: event.target.checked })
                      }
                    />
                    {line.label}
                  </label>
                  <div className="mt-1">
                    <ChartColorPicker
                      label={line.label}
                      showLabel={false}
                      color={style.color}
                      opacity={style.opacity}
                      fallback={line.defaultColor}
                      onChange={(color, opacity) =>
                        onChange(openId, line.id, { ...style, color, opacity })
                      }
                    />
                  </div>
                  {line.id === "histogram" ? null : (
                    <div className="mt-1 flex gap-1" role="group" aria-label={`${line.label} width`}>
                      {([1, 2, 3] as const).map((width) => (
                        <button
                          key={width}
                          type="button"
                          aria-pressed={style.lineWidth === width}
                          className={`rounded-control px-2 py-0.5 text-xs ${
                            style.lineWidth === width
                              ? "bg-accent-strong text-ink"
                              : "text-ink-muted hover:text-ink"
                          }`}
                          onClick={() => onChange(openId, line.id, { ...style, lineWidth: width })}
                        >
                          {width}px
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-control border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink"
              onClick={() => onSaveGlobal(openId)}
            >
              Save as global
            </button>
            <button
              type="button"
              className="rounded-control border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink"
              onClick={() => onReset(openId)}
            >
              Reset to default
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function legendPaint(style: IndicatorLineStyle, fallback: string): string {
  if (!style.color) {
    return style.opacity >= 100 ? fallback : colorWithOpacity(fallback, style.opacity);
  }
  if (style.color.startsWith("#")) {
    return style.opacity >= 100 ? style.color : colorWithOpacity(style.color, style.opacity);
  }
  if (style.opacity >= 100) {
    return `var(--color-${style.color})`;
  }
  return `color-mix(in srgb, var(--color-${style.color}) ${style.opacity}%, transparent)`;
}

