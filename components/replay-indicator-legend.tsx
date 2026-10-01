"use client";

import { useState } from "react";
import { IconClose, IconUiPrefs } from "@/components/icons";
import type { ReplayIndicatorLegendRow } from "@/lib/backtest/chart-series";
import type { IndicatorStyleTarget } from "@/lib/backtest/chart-series";
import {
  INDICATOR_STYLE_COLORS,
  indicatorLineStyle,
  type IndicatorLineStyle,
  type IndicatorStyleColor,
  type IndicatorStyleMap,
} from "@/lib/backtest/indicator-style";

const SWATCH: Record<IndicatorStyleColor, string> = {
  accent: "bg-accent",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
  "ink-muted": "bg-ink-muted",
  "ink-faint": "bg-ink-faint",
};

export function ReplayIndicatorLegend({
  rows,
  targets,
  names,
  session,
  saved,
  belowNotice,
  onChange,
  onSaveGlobal,
  onReset,
}: {
  rows: ReplayIndicatorLegendRow[];
  targets: Record<string, IndicatorStyleTarget[]>;
  names: Record<string, string>;
  session: IndicatorStyleMap;
  saved: IndicatorStyleMap;
  belowNotice: boolean;
  onChange: (layerId: string, lineId: string, style: IndicatorLineStyle) => void;
  onSaveGlobal: (layerId: string) => void;
  onReset: (layerId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openTargets = openId ? targets[openId] : null;
  return (
    <>
      <div
        className={`pointer-events-none absolute left-2 z-10 flex max-w-[70%] flex-col ${
          belowNotice ? "top-11" : "top-2"
        }`}
        aria-label="Active indicators"
      >
        {rows.map((row) => (
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
              {row.values.map((value) => {
                const style = indicatorLineStyle(session, saved, row.id, value.id);
                if (!style.visible) {
                  return null;
                }
                const color = style.color ? `var(--color-${style.color})` : value.color;
                return (
                  <span key={value.id} style={{ color }}>
                    {" "}
                    {value.text}
                  </span>
                );
              })}
            </p>
          </div>
        ))}
      </div>
      {openId && openTargets ? (
        <div
          className={`absolute left-2 z-30 w-80 rounded-card border border-line bg-surface p-3 ${
            belowNotice ? "top-11" : "top-2"
          }`}
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
                  <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label={`${line.label} color`}>
                    <Swatch
                      label="Default"
                      selected={style.color == null}
                      className="bg-surface-raised"
                      onClick={() => onChange(openId, line.id, { ...style, color: null })}
                    />
                    {INDICATOR_STYLE_COLORS.map((swatch) => (
                      <Swatch
                        key={swatch.id}
                        label={swatch.label}
                        selected={style.color === swatch.id}
                        className={SWATCH[swatch.id]}
                        onClick={() => onChange(openId, line.id, { ...style, color: swatch.id })}
                      />
                    ))}
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
      className={`size-4 rounded-full border ${
        selected ? "border-ink" : "border-line"
      } ${className}`}
      onClick={onClick}
    />
  );
}

