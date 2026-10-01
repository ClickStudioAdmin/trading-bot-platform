"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  CHART_COLOR_PALETTE,
  chartColorInputHex,
  normalizeChartColor,
  type IndicatorStyleColor,
} from "@/lib/backtest/chart-color";

const POPOVER_WIDTH = 256;

export function ChartColorPicker({
  label,
  color,
  opacity,
  fallback,
  pickerHex,
  showLabel = true,
  onChange,
}: {
  label: string;
  color: string | null;
  opacity: number;
  fallback: string;
  pickerHex?: string;
  showLabel?: boolean;
  onChange: (color: string | null, opacity: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ top: 0, left: 0 });
  const chosen = normalizeChartColor(color);
  const preview = swatchCss(chosen, fallback);

  function toggle(node: HTMLButtonElement) {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = node.getBoundingClientRect();
    const height = 300;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - POPOVER_WIDTH - 8);
    }
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - height - 4);
    }
    setPlace({ top, left });
    setOpen(true);
  }

  return (
    <div>
      {showLabel ? <p className="text-xs text-ink">{label}</p> : null}
      <button
        type="button"
        className="mt-1 inline-flex size-7 items-center justify-center rounded-control border border-line-strong bg-surface p-0.5"
        aria-label={`${label} colour`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(event) => toggle(event.currentTarget)}
      >
        <SwatchFill color={preview} opacity={opacity} />
      </button>
      {open
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close colour"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-label={`${label} colour`}
                className="fixed z-50 rounded-card border border-line bg-surface p-2"
                style={{ top: place.top, left: place.left, width: POPOVER_WIDTH }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-ink-muted">Colour</p>
                  <button
                    type="button"
                    className="rounded-control px-1.5 py-0.5 text-xs text-ink-muted hover:text-ink"
                    onClick={() => onChange(null, 100)}
                  >
                    Default
                  </button>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {CHART_COLOR_PALETTE.map((swatch) => (
                    <PaletteSwatch
                      key={swatch}
                      label={swatch}
                      css={swatch}
                      selected={chosen === swatch}
                      onClick={() => onChange(swatch, opacity)}
                    />
                  ))}
                </div>
                <div className="mt-2">
                  <p className="text-xs text-ink-muted">Precision</p>
                  <label className="relative mt-1 inline-flex size-5 items-center justify-center rounded-control border border-line text-xs text-ink">
                    +
                    <input
                      type="color"
                      aria-label={`${label} precision colour`}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      value={chartColorInputHex(chosen, pickerHex ?? fallback)}
                      onChange={(event) => {
                        const next = normalizeChartColor(event.target.value);
                        if (next) {
                          onChange(next, opacity);
                        }
                      }}
                    />
                  </label>
                </div>
                <label className="mt-2 block text-xs text-ink">
                  Opacity
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={opacity}
                    aria-label={`${label} opacity`}
                    aria-valuetext={`${opacity}%`}
                    className="mt-1 w-full accent-accent"
                    onChange={(event) => onChange(chosen, Number(event.target.value))}
                  />
                </label>
                <p className="text-xs text-ink-faint">{opacity}%</p>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function swatchCss(color: string | null, fallback: string): string {
  if (!color) {
    return fallback;
  }
  if (color.startsWith("#")) {
    return color;
  }
  return `var(--color-${color as IndicatorStyleColor})`;
}

function PaletteSwatch({
  label,
  css,
  selected,
  onClick,
}: {
  label: string;
  css: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={`size-5 rounded-control border ${selected ? "border-ink" : "border-line"}`}
      style={{ backgroundColor: css }}
      onClick={onClick}
    />
  );
}

function SwatchFill({ color, opacity }: { color: string; opacity: number }) {
  return (
    <span
      className="relative block size-full overflow-hidden rounded-[3px] bg-[linear-gradient(45deg,var(--color-line)_25%,transparent_25%),linear-gradient(-45deg,var(--color-line)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--color-line)_75%),linear-gradient(-45deg,transparent_75%,var(--color-line)_75%)] bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0]"
    >
      <span className="absolute inset-0" style={{ backgroundColor: color, opacity: opacity / 100 }} />
    </span>
  );
}
