"use client";

import { useEffect, useId, useRef, useState } from "react";

const OPTIONS = [
  { value: "", label: "Clone existing bot" },
  { value: "dca-btc", label: "DCA · BTCUSDT" },
  { value: "dca-eth", label: "DCA · ETHUSDT" },
  { value: "perps-sol", label: "Perps · SOLUSDT" },
] as const;

const FIELD_OPTIONS = [
  { value: "bybit", label: "Bybit" },
  { value: "hyperliquid", label: "Hyperliquid" },
] as const;

export function ThemeSelectDraft() {
  return (
    <div className="mt-6 space-y-4">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">
        Dropdown (draft)
      </p>
      <p className="text-sm text-ink-muted">
        Native option lists cannot use Geist or our tokens. This is a custom
        listbox: same closed chrome as the trigger, panel is surface with
        raised hover and accent on the selected row. Sample only.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <DraftListbox
          label="Action menu"
          variant="action"
          options={[...OPTIONS]}
          defaultValue=""
        />
        <DraftListbox
          label="Field"
          variant="field"
          options={[...FIELD_OPTIONS]}
          defaultValue="bybit"
        />
      </div>
    </div>
  );
}

function DraftListbox({
  label,
  variant,
  options,
  defaultValue,
}: {
  label: string;
  variant: "action" | "field";
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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

  const trigger =
    variant === "action"
      ? "inline-flex min-w-[12rem] items-center justify-between gap-3 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
      : "mt-1 inline-flex w-full min-w-[12rem] items-center justify-between gap-3 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink hover:border-line-strong";

  return (
    <div ref={rootRef} className="relative min-w-[12rem]">
      <p className="text-xs text-ink-muted">{label}</p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={trigger}
      >
        <span>{selected?.label}</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full min-w-[14rem] overflow-auto rounded-card border border-line bg-surface p-1 shadow-none"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value || "placeholder"} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setValue(option.value);
                    setOpen(false);
                  }}
                  className={
                    active
                      ? "flex w-full rounded-control bg-accent/15 px-3 py-2 text-left text-sm text-ink"
                      : "flex w-full rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-surface-raised"
                  }
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className={`size-3 shrink-0 ${open ? "rotate-180" : ""}`}
    >
      <path
        d="m2.5 4.5 3.5 3.5 3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
