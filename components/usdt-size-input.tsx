"use client";

import { useState } from "react";
import { formatUsdCapacity } from "@/lib/opportunities/format";
import {
  clampNotionalInput,
  formatGroupedNumberInput,
  formatNotionalInput,
  maxPaperNotionalUsdt,
  parseNotionalUsdt,
  type OpportunityPaperProps,
} from "@/lib/paper/open";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export function OpportunityBookAndSize({
  row,
  paper,
  formId,
}: {
  row: ScannedOpportunity;
  paper?: OpportunityPaperProps;
  formId: string;
}) {
  const [size, setSize] = useState("");
  const label = formatUsdCapacity(row.capacityUsdt);
  const canFill = Boolean(paper?.signedIn && paper.canOpen) && label !== "—";

  return (
    <>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {canFill ? (
          <span
            className="cursor-pointer"
            aria-label={`Fill size with ${label}`}
            onClick={() =>
              setSize(
                clampNotionalInput(
                  String(maxPaperNotionalUsdt(row.capacityUsdt)),
                  row.capacityUsdt,
                ),
              )
            }
          >
            {label}
          </span>
        ) : (
          label
        )}
      </td>
      {paper ? (
        <td className="px-4 py-3">
          {paper.signedIn && paper.canOpen ? (
            <UsdtSizeInput
              name="notionalUsdt"
              display={size}
              onDisplayChange={setSize}
              maxUsdt={row.capacityUsdt}
              ariaLabel={`Paper size in USDT for ${row.futureSymbol}`}
              form={formId}
            />
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </td>
      ) : null}
    </>
  );
}

export function UsdtSizeInput({
  name,
  defaultValue,
  display: displayProp,
  onDisplayChange,
  ariaLabel,
  form,
  compact,
  showPrefix = true,
  maxUsdt,
}: {
  name: string;
  defaultValue?: number | string;
  display?: string;
  onDisplayChange?: (value: string) => void;
  ariaLabel: string;
  form?: string;
  compact?: boolean;
  showPrefix?: boolean;
  maxUsdt?: number;
}) {
  const [internal, setInternal] = useState(
    formatNotionalInput(String(defaultValue ?? "")),
  );
  const display = displayProp ?? internal;
  const setDisplay = onDisplayChange ?? setInternal;
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

const DEFAULT_GROUPED_CLASS =
  "mt-0.5 w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-xs tabular-nums text-ink focus:border-line-strong focus:outline-none";

export function GroupedNumberInput({
  name,
  id,
  defaultValue = "",
  value,
  onChange,
  allowDecimal = false,
  placeholder,
  className = DEFAULT_GROUPED_CLASS,
  ariaLabel,
}: {
  name?: string;
  id?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (next: string) => void;
  allowDecimal?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [internal, setInternal] = useState(() =>
    formatGroupedNumberInput(defaultValue, allowDecimal),
  );
  const display = formatGroupedNumberInput(
    value !== undefined ? value : internal,
    allowDecimal,
  );

  function apply(raw: string) {
    const next = formatGroupedNumberInput(raw, allowDecimal);
    if (value === undefined) {
      setInternal(next);
    }
    onChange?.(next);
  }

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      spellCheck={false}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={display}
      onChange={(event) => {
        apply(event.target.value);
      }}
      onBlur={(event) => {
        apply(event.target.value);
      }}
      className={className}
    />
  );
}
