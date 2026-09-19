"use client";

import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconChevronDown, IconClose } from "@/components/icons";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";
import { TokenIcon } from "@/components/token-icon";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: string;
  group?: string;
};

export type AppSelectChangeEvent = ChangeEvent<HTMLInputElement>;

export const LiveFilterSubmit = createContext<(() => void) | null>(null);

const FIELD_TRIGGER =
  "inline-flex w-full min-w-0 items-center justify-between gap-3 rounded-control border border-line bg-surface-raised px-3 py-2 text-left text-sm text-ink hover:border-line-strong focus:border-line-strong focus:outline-none disabled:opacity-40";
const ACTION_TRIGGER =
  "inline-flex w-max max-w-full shrink-0 items-center justify-between gap-3 rounded-control bg-accent-strong px-4 py-2 text-left text-sm font-medium text-ink hover:bg-accent focus:outline-none disabled:opacity-40";

function selectRootClass(variant: "field" | "action", className: string) {
  const base =
    variant === "action" ? "inline-flex max-w-full" : "block min-w-0";
  const layout = className
    .split(/\s+/)
    .filter(
      (token) =>
        token &&
        !/^(rounded-|border|bg-|px-|py-|pt-|pb-|pl-|pr-|text-|font-|hover:|focus|disabled:|placeholder:)/.test(
          token,
        ),
    )
    .join(" ");
  return `${base} ${layout}`.trim();
}

export function AppSelect({
  name,
  value,
  defaultValue,
  options,
  children,
  onChange,
  disabled = false,
  required = false,
  variant = "field",
  className = "",
  id,
  "aria-label": ariaLabel,
  searchable = false,
}: {
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  options?: readonly AppSelectOption[];
  children?: ReactNode;
  onChange?: (event: AppSelectChangeEvent) => void;
  disabled?: boolean;
  required?: boolean;
  variant?: "field" | "action";
  className?: string;
  id?: string;
  "aria-label"?: string;
  searchable?: boolean;
}) {
  const liveSubmit = useContext(LiveFilterSubmit);
  const listId = useId();
  const triggerId = id ?? listId;
  const hiddenRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(
    () => options ?? optionsFromChildren(children),
    [children, options],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [uncontrolled, setUncontrolled] = useState(
    String(defaultValue ?? parsed[0]?.value ?? ""),
  );
  const current = value != null ? String(value) : uncontrolled;
  const selected =
    parsed.find((option) => option.value === current) ?? parsed[0];
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return parsed;
    }
    return parsed.filter((option) => option.label.toLowerCase().includes(needle));
  }, [parsed, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  function pick(next: string) {
    if (value == null) {
      setUncontrolled(next);
    }
    if (hiddenRef.current) {
      hiddenRef.current.value = next;
    }
    const input = hiddenRef.current;
    if (input && onChange) {
      onChange({
        target: input,
        currentTarget: input,
      } as AppSelectChangeEvent);
    }
    liveSubmit?.();
    close();
  }

  const triggerClass =
    variant === "action" ? ACTION_TRIGGER : FIELD_TRIGGER;
  const rootClass = selectRootClass(variant, className);

  return (
    <span className={rootClass}>
      {name ? (
        <input
          ref={hiddenRef}
          type="hidden"
          name={name}
          value={current}
          required={required}
        />
      ) : (
        <input ref={hiddenRef} type="hidden" value={current} />
      )}
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : setOpen(true))}
        className={`${triggerClass} ${className}`.trim()}
      >
        <OptionLabel option={selected} />
        <Chevron open={open} />
      </button>
      {open
        ? createPortal(
            <SelectPanel
              panelRef={panelRef}
              listId={listId}
              triggerRef={triggerRef}
              searchable={searchable}
              query={query}
              onQuery={setQuery}
            >
              {visible.length === 0 ? (
                <p className="px-3 py-2 text-sm text-ink-muted">No matches.</p>
              ) : (
                <OptionList
                  options={visible}
                  selected={current}
                  onPick={pick}
                />
              )}
            </SelectPanel>,
            document.body,
          )
        : null}
    </span>
  );
}

export function AppMultiSelect({
  name,
  options,
  value,
  defaultValue = [],
  onChange,
  placeholder = "Select…",
  className = "",
  max,
}: {
  name?: string;
  options: readonly AppSelectOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  max?: number;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [uncontrolled, setUncontrolled] = useState<string[]>(defaultValue);
  const selected = value ?? uncontrolled;
  const picked = useMemo(
    () =>
      selected
        .map((item) => options.find((option) => option.value === item))
        .filter((option): option is AppSelectOption => Boolean(option)),
    [options, selected],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  function toggleValue(nextValue: string) {
    const option = options.find((row) => row.value === nextValue);
    if (option?.disabled) {
      return;
    }
    const on = selected.includes(nextValue);
    if (!on && max != null && selected.length >= max) {
      return;
    }
    const next = on
      ? selected.filter((item) => item !== nextValue)
      : [...selected, nextValue];
    if (value == null) {
      setUncontrolled(next);
    }
    onChange?.(next);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  return (
    <>
      {name
        ? selected.map((item) => (
            <input key={item} type="hidden" name={name} value={item} />
          ))
        : null}
      <div
        ref={triggerRef}
        className={`relative flex w-full min-w-0 flex-wrap items-center gap-2 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink hover:border-line-strong focus-within:border-line-strong ${className}`.trim()}
      >
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={placeholder}
          onClick={() => (open ? close() : setOpen(true))}
          className="absolute inset-0 z-0 rounded-control focus:outline-none"
        />
        <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {picked.length === 0 ? (
            <span className="text-ink-faint">{placeholder}</span>
          ) : (
            picked.map((option) => (
              <span
                key={option.value}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent/15 py-0.5 pr-1 pl-2 text-xs text-ink"
              >
                <OptionLabel option={option} size={14} />
                <button
                  type="button"
                  aria-label={`Remove ${option.label}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleValue(option.value);
                  }}
                  className="pointer-events-auto inline-flex size-4 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-accent/25 hover:text-ink"
                >
                  <IconClose size={10} className="size-2.5" />
                </button>
              </span>
            ))
          )}
        </div>
        <span className="pointer-events-none relative z-10 ml-auto inline-flex shrink-0 text-ink">
          <Chevron open={open} />
        </span>
      </div>
      {open
        ? createPortal(
            <SelectPanel
              panelRef={panelRef}
              listId={listId}
              triggerRef={triggerRef}
              searchable
              query={query}
              onQuery={setQuery}
            >
              <OptionList
                options={visible}
                selected={selected}
                onPick={toggleValue}
                disableUnselected={
                  max != null && selected.length >= max
                }
              />
            </SelectPanel>,
            document.body,
          )
        : null}
    </>
  );
}

function SelectPanel({
  panelRef,
  listId,
  triggerRef,
  searchable,
  query,
  onQuery,
  children,
}: {
  panelRef: { current: HTMLDivElement | null };
  listId: string;
  triggerRef: { current: HTMLElement | null };
  searchable: boolean;
  query: string;
  onQuery: (value: string) => void;
  children: ReactNode;
}) {
  const previewClass = useThemePreviewPortalClass();
  const [box, setBox] = useState({ top: 0, left: 0, width: 220 });

  useLayoutEffect(() => {
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 176);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      const below = rect.bottom + 4;
      const maxHeight = 224;
      const top =
        below + maxHeight > window.innerHeight - 8
          ? Math.max(8, rect.top - maxHeight - 4)
          : below;
      setBox({ top, left: Math.max(8, left), width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [triggerRef]);

  return (
    <div
      ref={(node) => {
        panelRef.current = node;
      }}
      id={listId}
      role="listbox"
      style={{ top: box.top, left: box.left, width: box.width }}
      className={`fixed z-50 flex max-h-56 flex-col overflow-hidden rounded-card border border-line bg-surface p-1 text-ink ${previewClass}`.trim()}
    >
      {searchable ? (
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search"
          autoComplete="off"
          className="mb-1 w-full shrink-0 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

function OptionList({
  options,
  selected,
  onPick,
  disableUnselected = false,
}: {
  options: readonly AppSelectOption[];
  selected: string | readonly string[];
  onPick: (value: string) => void;
  disableUnselected?: boolean;
}) {
  return options.map((option, index) => {
    const on = Array.isArray(selected)
      ? selected.includes(option.value)
      : option.value === selected;
    const heading =
      option.group && option.group !== options[index - 1]?.group ? (
        <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          {option.group}
        </p>
      ) : null;
    return (
      <Fragment key={option.value || `empty-${index}`}>
        {heading}
        <button
          type="button"
          role="option"
          aria-selected={on}
          disabled={option.disabled || (!on && disableUnselected)}
          onClick={() => onPick(option.value)}
          className={
            on
              ? "flex w-full rounded-control bg-accent/15 px-3 py-2 text-left text-sm text-ink disabled:opacity-40"
              : "flex w-full rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-surface-raised disabled:opacity-40"
          }
        >
          <OptionLabel option={option} />
        </button>
      </Fragment>
    );
  });
}

export function optionsFromChildren(
  children: ReactNode,
  group?: string,
): AppSelectOption[] {
  const rows: AppSelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    if (child.type === "optgroup") {
      const props = child.props as {
        label?: string;
        children?: ReactNode;
      };
      rows.push(...optionsFromChildren(props.children, props.label ?? ""));
      return;
    }
    if (child.type !== "option") {
      return;
    }
    const props = child.props as {
      value?: string | number;
      children?: ReactNode;
      disabled?: boolean;
    };
    rows.push({
      value: String(props.value ?? ""),
      label: flattenLabel(props.children),
      disabled: Boolean(props.disabled),
      ...(group ? { group } : {}),
    });
  });
  return rows;
}

function flattenLabel(node: ReactNode): string {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(flattenLabel).join("");
  }
  if (isValidElement(node)) {
    return flattenLabel((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function OptionLabel({
  option,
  size = 18,
}: {
  option?: AppSelectOption;
  size?: number;
}) {
  if (!option) {
    return <span className="min-w-0 truncate" />;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {option.icon ? <TokenIcon symbol={option.icon} size={size} /> : null}
      <span className="min-w-0 truncate">{option.label}</span>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <IconChevronDown
      size={12}
      className={`size-3 shrink-0 ${open ? "rotate-180" : ""}`}
    />
  );
}
