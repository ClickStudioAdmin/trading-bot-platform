"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isoDateUtc } from "@/lib/backtest/model";
import { AppSelect } from "@/components/app-select";
import { useModalPortalHost } from "@/components/portal-host";

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
] as const;
const MONTH_OPTIONS = MONTHS.map((label, value) => ({
  value: String(value),
  label,
}));

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const portalHost = useModalPortalHost();
  const [box, setBox] = useState({ top: 0, left: 0 });
  const [open, setOpen] = useState(false);
  const selected = parseIso(value) ?? new Date();
  const [cursor, setCursor] = useState({
    year: selected.getUTCFullYear(),
    month: selected.getUTCMonth(),
  });
  const cursorKey = open ? value : "";
  const [cursorKeySeen, setCursorKeySeen] = useState(cursorKey);
  if (open && cursorKey !== cursorKeySeen) {
    const next = parseIso(value) ?? new Date();
    setCursorKeySeen(cursorKey);
    setCursor({
      year: next.getUTCFullYear(),
      month: next.getUTCMonth(),
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      if (target instanceof Element && target.closest('[role="listbox"]')) {
        return;
      }
      setOpen(false);
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

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const width = 288;
      const height = panelRef.current?.offsetHeight ?? 320;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const below = rect.bottom + 4;
      const top =
        below + height > window.innerHeight - 8
          ? Math.max(8, rect.top - height - 4)
          : below;
      setBox((current) =>
        current.top === top && current.left === left ? current : { top, left },
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, cursor.month, cursor.year]);

  const [today] = useState(() => isoDateUtc(Date.now()));
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
      <p className="text-sm text-ink">{label}</p>
      <input type="hidden" name={name} value={value} />
      <button
        ref={buttonRef}
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
      {open && portalHost
        ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          style={{ top: box.top, left: box.left }}
          className="fixed z-[70] w-72 rounded-card border border-line bg-surface-raised p-3 shadow-none"
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
            <AppSelect
              value={String(cursor.month)}
              onChange={(event) =>
                setCursor((current) => ({
                  ...current,
                  month: Number(event.target.value),
                }))
              }
              className="min-w-[8.5rem] flex-1"
              options={MONTH_OPTIONS}
            />
            <AppSelect
              value={String(cursor.year)}
              onChange={(event) =>
                setCursor((current) => ({
                  ...current,
                  year: Number(event.target.value),
                }))
              }
              className="w-24 shrink-0"
              options={years.map((year) => ({
                value: String(year),
                label: String(year),
              }))}
            />
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
        </div>,
        portalHost,
        )
        : null}
    </div>
  );
}
