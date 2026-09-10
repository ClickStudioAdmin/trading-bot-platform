"use client";

import { type ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import {
  statusOptionsFor,
  type BotDeskKind,
  type BotStatusOption,
} from "@/lib/bots/status";

export const botFieldClass =
  "mt-1 w-full rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
export const botFieldInvalidClass =
  "mt-1 w-full rounded-control border border-danger bg-surface-raised px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none";
export const botLabelClass = "block text-xs text-ink-muted";
export const botSectionTitleClass =
  "text-xs font-semibold uppercase tracking-[0.1em] text-ink";
export const botRowClass = "grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-4";
export const botRowClass5 = "grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-5";
export const botHeaderPrimaryClass =
  "rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent";
export const botHeaderGhostClass =
  "shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink";
export const botHeaderRemoveClass =
  "shrink-0 rounded-control border border-line px-2 py-0.5 text-xs text-danger hover:bg-danger/10";

export function HintLabel({
  text,
  hint,
  required = false,
  className,
}: {
  text: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  const label = (
    <span className={className}>
      {text}
      {required ? (
        <>
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
          <span className="sr-only"> required</span>
        </>
      ) : null}
    </span>
  );
  return hint ? <ColumnHint label={label} hint={hint} /> : label;
}

export function EnableCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border ${
        checked
          ? "border-accent bg-accent text-canvas"
          : "border-line-strong bg-surface-raised"
      }`}
      aria-hidden
    >
      {checked ? (
        <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-current stroke-[1.8]">
          <path d="M2 6.2 4.6 9 10 3" />
        </svg>
      ) : null}
    </span>
  );
}

export function OptionalSection({
  title,
  hint,
  enabled,
  onEnabled,
  nested = false,
  locked = false,
  children,
}: {
  title: string;
  hint?: string;
  enabled: boolean;
  onEnabled: (next: boolean) => void;
  nested?: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`col-span-full block w-full min-w-0 ${
        nested ? "space-y-3" : "space-y-3 py-5"
      }${locked ? " pointer-events-none opacity-40" : ""}`}
      inert={locked || undefined}
      aria-disabled={locked || undefined}
    >
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabled(event.target.checked)}
          className="sr-only"
        />
        <EnableCheck checked={enabled} />
        <HintLabel text={title} hint={hint} className={botSectionTitleClass} />
      </label>
      {enabled ? children : null}
    </section>
  );
}

export function BotFormGroup({
  title,
  hint,
  locked = false,
  className,
  children,
}: {
  title?: string;
  hint?: string;
  locked?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`col-span-full block w-full min-w-0 space-y-3 py-5${
        locked ? " pointer-events-none opacity-40" : ""
      }${className ? ` ${className}` : ""}`}
      inert={locked || undefined}
      aria-disabled={locked || undefined}
    >
      {title ? (
        <h3 className={botSectionTitleClass}>
          <HintLabel text={title} hint={hint} />
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export function BotField({
  label,
  hint,
  required = false,
  className,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={`${botLabelClass} ${className ?? ""}`}>
      <HintLabel text={label} hint={hint} required={required} />
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function OrderTypePill({
  value,
  onChange,
  name,
}: {
  value: "market" | "limit";
  onChange?: (next: "market" | "limit") => void;
  name?: string;
}) {
  return (
    <span className="mt-1 flex w-fit rounded-control border border-line bg-surface p-0.5">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {(["market", "limit"] as const).map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            className={
              selected
                ? "rounded-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink"
                : "rounded-control px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
            }
            onClick={() => onChange?.(option)}
          >
            {option === "market" ? "Market" : "Limit"}
          </button>
        );
      })}
    </span>
  );
}

export function StatusLight({
  fill,
  label,
  inUse = false,
}: {
  fill: string;
  label?: string;
  inUse?: boolean;
}) {
  const title = label
    ? inUse
      ? `${label} · in use by an open position`
      : label
    : inUse
      ? "In use by an open position"
      : "Status";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <span
        className="relative flex size-3.5 shrink-0"
        title={title}
        aria-label={title}
      >
        {inUse ? (
          <span
            className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${fill}`}
          />
        ) : null}
        <span className={`relative inline-flex size-3.5 rounded-full ${fill}`} />
      </span>
    </span>
  );
}

export function BotStatusField({
  desk,
  name,
  value,
  onChange,
  inUse = false,
  accountReduceOnly = false,
}: {
  desk: BotDeskKind;
  name: string;
  value: string;
  onChange: (next: string) => void;
  inUse?: boolean;
  accountReduceOnly?: boolean;
}) {
  const options = statusOptionsFor(desk);
  const selected =
    options.find((option) => option.value === value) ?? options[0];
  return (
    <div>
      <p className={botLabelClass}>
        <HintLabel text="Status" hint={selected.note} />
      </p>
      <div className="mt-1 flex items-center gap-2">
        <select
          name={name}
          className={`${botFieldClass} mt-0 min-w-0 flex-1`}
          value={selected.value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Status"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value === "active" && accountReduceOnly
                ? "Active"
                : option.label}
            </option>
          ))}
        </select>
        <StatusLight
          fill={selected.fill}
          label={
            accountReduceOnly && selected.value === "active"
              ? "Active · book Reduce only has priority"
              : selected.label
          }
          inUse={inUse}
        />
      </div>
    </div>
  );
}

export function DirtySaveBanner({
  dirty,
  error,
  children,
}: {
  dirty: boolean;
  error?: string;
  children: ReactNode;
}) {
  if (!dirty && !error) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        {dirty ? (
          <p className="text-sm text-warning">
            You have unsaved changes on this bot
          </p>
        ) : null}
        {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function AdditionalActions({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="col-span-full flex w-full min-w-0 flex-wrap items-center justify-between gap-2 py-5">
      <h3 className={botSectionTitleClass}>Additional Actions</h3>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </section>
  );
}

export function triggerSectionTitle(kind: string): string {
  if (kind === "indicator") {
    return "Trigger - Indicator";
  }
  if (kind === "trend") {
    return "Trigger - Trend";
  }
  if (kind === "webhook") {
    return "Trigger - Signal Webhook";
  }
  return "Trigger - Price Cross";
}

export function selectedStatusOption(
  desk: BotDeskKind,
  value: string,
): BotStatusOption {
  const options = statusOptionsFor(desk);
  return options.find((option) => option.value === value) ?? options[0];
}
