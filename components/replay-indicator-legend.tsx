"use client";

import { useState, type ReactNode } from "react";
import { ChartColorPicker } from "@/components/chart-color-picker";
import { IconChevronDown, IconUiPrefs } from "@/components/icons";
import { Modal } from "@/components/template-modals";
import type {
  IndicatorInput,
  ReplayIndicatorLegendRow,
} from "@/lib/backtest/chart-series";
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
  inputs,
  inputsLocked,
  timeframes,
  session,
  saved,
  onChange,
  onSaveGlobal,
  onReset,
  onInput,
}: {
  rows: ReplayIndicatorLegendRow[];
  targets: Record<string, IndicatorStyleTarget[]>;
  names: Record<string, string>;
  inputs: Record<string, IndicatorInput[]>;
  inputsLocked: Record<string, boolean>;
  timeframes: Record<string, string>;
  session: IndicatorStyleMap;
  saved: IndicatorStyleMap;
  onChange: (layerId: string, lineId: string, style: IndicatorLineStyle) => void;
  onSaveGlobal: (layerId: string) => void;
  onReset: (layerId: string) => void;
  onInput: (layerId: string, inputId: IndicatorInput["id"], value: number) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shown, setShown] = useState(true);
  const [tab, setTab] = useState<"inputs" | "style">("inputs");
  const openTargets = openId ? targets[openId] : null;
  const openInputs = openId ? inputs[openId] : null;
  const locked = openId ? (inputsLocked[openId] ?? true) : true;
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
              aria-label={`Settings ${row.name}`}
              aria-expanded={openId === row.id}
              onClick={() => {
                setTab("inputs");
                setOpenId((current) => (current === row.id ? null : row.id));
              }}
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
      {shown && openId && openTargets && openInputs ? (
        <Modal
          title={names[openId] ?? "Indicator"}
          onClose={() => setOpenId(null)}
          elevated
        >
          <div className="mt-4 flex border-b border-line" role="tablist" aria-label="Indicator settings">
            {(["inputs", "style"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                  tab === id
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
                onClick={() => setTab(id)}
              >
                {id === "inputs" ? "Inputs" : "Style"}
              </button>
            ))}
          </div>
          {tab === "inputs" ? (
            <div className="mt-4 space-y-3" role="tabpanel">
              <SettingRow label="Timeframe" muted>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={timeframes[openId] ?? "Chart"}
                  aria-label="Timeframe"
                  className="w-28 rounded-control border border-line bg-surface px-2 py-1 text-right text-sm text-ink-faint"
                />
              </SettingRow>
              {openInputs.map((field) => (
                <IndicatorNumberField
                  key={field.id}
                  field={field}
                  locked={locked}
                  onCommit={(value) => onInput(openId, field.id, value)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4" role="tabpanel">
              <div className="space-y-4">
                {openTargets.map((line, index) => {
                  const style = indicatorLineStyle(session, saved, openId, line.id);
                  return (
                    <section
                      key={line.id}
                      className={index > 0 ? "space-y-3 border-t border-line pt-4" : "space-y-3"}
                    >
                      {openTargets.length > 1 ? (
                        <h3 className="text-sm font-semibold text-ink">{line.label}</h3>
                      ) : null}
                      <SettingRow label="Visible">
                        <input
                          type="checkbox"
                          className="size-4 accent-accent"
                          checked={style.visible}
                          aria-label={`${line.label} visible`}
                          onChange={(event) =>
                            onChange(openId, line.id, { ...style, visible: event.target.checked })
                          }
                        />
                      </SettingRow>
                      <SettingRow label="Colour">
                        <ChartColorPicker
                          label={`${line.label} colour`}
                          showLabel={false}
                          color={style.color}
                          opacity={style.opacity}
                          fallback={line.defaultColor}
                          onChange={(color, opacity) =>
                            onChange(openId, line.id, { ...style, color, opacity })
                          }
                        />
                      </SettingRow>
                      {line.id === "histogram" ? null : (
                        <SettingRow label="Line width">
                          <div className="flex gap-1" role="group" aria-label={`${line.label} line width`}>
                            {([1, 2, 3] as const).map((width) => (
                              <button
                                key={width}
                                type="button"
                                aria-pressed={style.lineWidth === width}
                                className={`rounded-control px-2 py-0.5 text-sm ${
                                  style.lineWidth === width
                                    ? "bg-accent-strong text-ink"
                                    : "text-ink-muted hover:text-ink"
                                }`}
                                onClick={() =>
                                  onChange(openId, line.id, { ...style, lineWidth: width })
                                }
                              >
                                {width}px
                              </button>
                            ))}
                          </div>
                        </SettingRow>
                      )}
                    </section>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  className="rounded-control border border-line px-2 py-1 text-sm text-ink-muted hover:text-ink"
                  onClick={() => onSaveGlobal(openId)}
                >
                  Save as global
                </button>
                <button
                  type="button"
                  className="rounded-control border border-line px-2 py-1 text-sm text-ink-muted hover:text-ink"
                  onClick={() => onReset(openId)}
                >
                  Reset to default
                </button>
              </div>
            </div>
          )}
        </Modal>
      ) : null}
    </>
  );
}

function SettingRow({
  label,
  muted = false,
  htmlFor,
  children,
}: {
  label: string;
  muted?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  const className = `text-sm ${muted ? "text-ink-faint" : "text-ink"}`;
  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={className}>
          {label}
        </label>
      ) : (
        <span className={className}>{label}</span>
      )}
      {children}
    </div>
  );
}

function IndicatorNumberField({
  field,
  locked,
  onCommit,
}: {
  field: IndicatorInput;
  locked: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <SettingRow label={field.label} muted={locked} htmlFor={`indicator-input-${field.id}`}>
      <input
        id={`indicator-input-${field.id}`}
        key={locked ? "locked" : `${field.id}-${field.value}`}
        type="number"
        inputMode="decimal"
        disabled={locked}
        min={field.min}
        max={field.max}
        step={field.step}
        {...(locked
          ? { value: field.value, onChange: () => undefined }
          : { defaultValue: field.value })}
        className={`w-28 rounded-control border border-line bg-surface px-2 py-1 text-right text-sm ${
          locked ? "text-ink-faint" : "text-ink"
        }`}
        onBlur={(event) => {
          if (locked) {
            return;
          }
          const parsed = Number(event.currentTarget.value);
          if (Number.isFinite(parsed)) {
            onCommit(parsed);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    </SettingRow>
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
