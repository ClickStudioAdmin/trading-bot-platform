"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isoDateUtc } from "@/lib/backtest/model";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLabel(value: string): string {
  const date = parseIso(value);
  if (!date) {
    return "Pick a date";
  }
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function clampIso(value: string, min?: string, max?: string): string {
  if (min && value < min) {
    return min;
  }
  if (max && value > max) {
    return max;
  }
  return value;
}

function monthGrid(year: number, month: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month, 1));
  const startPad = first.getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(isoDateUtc(Date.UTC(year, month, day)));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function DatePicker({
  name,
  value,
  onChange,
  min,
  max,
  label,
}: {
  name: string;
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
  label: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseIso(value) ?? new Date();
  const [cursor, setCursor] = useState({
    year: selected.getUTCFullYear(),
    month: selected.getUTCMonth(),
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const next = parseIso(value) ?? new Date();
    setCursor({
      year: next.getUTCFullYear(),
      month: next.getUTCMonth(),
    });
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const today = isoDateUtc(Date.now());
  const maxDate = max ?? today;
  const minYear = min ? Number(min.slice(0, 4)) : new Date().getUTCFullYear() - 20;
  const maxYear = Number(maxDate.slice(0, 4));
  const years = useMemo(() => {
    const rows: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) {
      rows.push(year);
    }
    return rows;
  }, [maxYear, minYear]);
  const cells = monthGrid(cursor.year, cursor.month);

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({
      year: next.getUTCFullYear(),
      month: next.getUTCMonth(),
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <p className="text-xs text-ink-muted">{label}</p>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="mt-1 flex w-full items-center justify-between rounded-control border border-line bg-canvas px-3 py-2 text-left text-sm text-ink hover:border-line-strong"
      >
        <span>{formatLabel(value)}</span>
        <span className="text-ink-faint" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute z-30 mt-1 w-72 rounded-card border border-line bg-surface-raised p-3 shadow-none"
        >
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-control px-2 py-1 text-sm text-ink-muted hover:bg-surface hover:text-ink"
              aria-label="Previous month"
            >
              ‹
            </button>
            <select
              value={cursor.month}
              onChange={(event) =>
                setCursor((current) => ({
                  ...current,
                  month: Number(event.target.value),
                }))
              }
              className="min-w-0 flex-1 rounded-control border border-line bg-canvas px-2 py-1 text-xs text-ink"
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
            <select
              value={cursor.year}
              onChange={(event) =>
                setCursor((current) => ({
                  ...current,
                  year: Number(event.target.value),
                }))
              }
              className="w-20 rounded-control border border-line bg-canvas px-2 py-1 text-xs text-ink"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-control px-2 py-1 text-sm text-ink-muted hover:bg-surface hover:text-ink"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-ink-faint">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} />;
              }
              const disabled = (min != null && day < min) || day > maxDate;
              const isSelected = day === value;
              const isToday = day === today;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(clampIso(day, min, maxDate));
                    setOpen(false);
                  }}
                  className={`rounded-control py-1.5 text-xs tabular-nums ${
                    isSelected
                      ? "bg-accent-strong text-ink"
                      : isToday
                        ? "text-accent hover:bg-surface"
                        : "text-ink hover:bg-surface"
                  } disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent`}
                >
                  {Number(day.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
