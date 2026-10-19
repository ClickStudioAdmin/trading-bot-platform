"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ParamSideChoice = "all" | "long" | "short";

const SIDE_OPTIONS: { value: ParamSideChoice; label: string }[] = [
  { value: "all", label: "All" },
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

export function ParamSideFilter({
  value,
  onChange,
}: {
  value: ParamSideChoice;
  onChange: (next: ParamSideChoice) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Side"
      className="flex gap-0.5 rounded-control border border-line bg-surface p-0.5"
    >
      {SIDE_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-control px-2 py-1 text-[11px] text-ink-muted ${
              active ? "bg-surface-raised font-medium" : "hover:bg-canvas"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Right side of the bot title row. The form portals its filter here. */
export const BOT_FORM_SIDE_SLOT = "bot-form-side-slot";

export function BotFormSideSlot() {
  return <div id={BOT_FORM_SIDE_SLOT} className="ml-auto flex shrink-0" />;
}

export function BotFormSideFilter({
  value,
  onChange,
}: {
  value: ParamSideChoice;
  onChange: (next: ParamSideChoice) => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null | undefined>(undefined);
  useLayoutEffect(() => {
    setSlot(document.getElementById(BOT_FORM_SIDE_SLOT));
  }, []);
  const control = <ParamSideFilter value={value} onChange={onChange} />;
  if (slot === undefined) {
    return null;
  }
  if (slot) {
    return createPortal(control, slot);
  }
  return <div className="flex justify-end">{control}</div>;
}

/** Keeps a side's fields mounted so a filtered view still submits them. */
export function BotFormSidePane({
  hidden,
  children,
}: {
  hidden: boolean;
  children: ReactNode;
}) {
  return <div hidden={hidden}>{children}</div>;
}
