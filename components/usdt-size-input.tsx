"use client";

import { useState } from "react";
import {
  clampNotionalInput,
  formatGroupedNumberInput,
  formatNotionalInput,
  parseNotionalUsdt,
} from "@/lib/paper/open";

export function UsdtSizeInput({
  name,
  defaultValue,
  ariaLabel,
  form,
  compact,
  showPrefix = true,
  maxUsdt,
}: {
  name: string;
  defaultValue?: number | string;
  ariaLabel: string;
  form?: string;
  compact?: boolean;
  showPrefix?: boolean;
  maxUsdt?: number;
}) {
  const [display, setDisplay] = useState(
    formatNotionalInput(String(defaultValue ?? "")),
  );
  const parsed = parseNotionalUsdt(display);

  return (
    <span className="flex items-center gap-1 text-ink-muted">
      {showPrefix ? "$" : null}
      <input type="hidden" name={name} value={parsed ?? ""} form={form} />
      <input
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        onChange={(event) =>
          setDisplay(
            maxUsdt === undefined
              ? formatNotionalInput(event.target.value)
              : clampNotionalInput(event.target.value, maxUsdt),
          )
        }
        className={
          compact
            ? "w-20 rounded-control border border-line bg-surface-raised px-1.5 py-1 text-xs tabular-nums text-ink focus:border-line-strong focus:outline-none"
            : "w-28 rounded-control border border-line bg-surface-raised px-2 py-1 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
        }
      />
    </span>
  );
}

export function GroupedNumberInput({
  name,
  defaultValue,
  allowDecimal = false,
}: {
  name: string;
  defaultValue: string;
  allowDecimal?: boolean;
}) {
  const [display, setDisplay] = useState(
    formatGroupedNumberInput(defaultValue, allowDecimal),
  );

  return (
    <input
      name={name}
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={display}
      onChange={(event) =>
        setDisplay(formatGroupedNumberInput(event.target.value, allowDecimal))
      }
      className="mt-0.5 w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-xs tabular-nums text-ink focus:border-line-strong focus:outline-none"
    />
  );
}
