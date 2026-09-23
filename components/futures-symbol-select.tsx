"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { IconChevronDown } from "@/components/icons";
import { TokenIcon } from "@/components/token-icon";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";
import {
  BYBIT_AGREEMENT_PICKER_NOTE,
  CLOSED_AGREEMENT_GATE,
  firstOpenPerp,
  perpNeedsBybitAgreement,
  type BybitAgreementGate,
} from "@/lib/exchanges/agreement";
import { ACCOUNT_EXCHANGES_HREF } from "@/lib/site-links";
import {
  formatPerpPairLabel,
  type LinearPerp,
} from "@/lib/exchanges/bybit/perp";

const PANEL_GAP = 4;
const PANEL_MARGIN = 8;
const PANEL_MAX_HEIGHT = 288;
const PANEL_MIN_WIDTH = 352;

export function FuturesSymbolSelect({
  options,
  defaultSymbol = "BTCUSDT",
  value,
  onChange,
  name = "symbol",
  allowEmpty = false,
  placeholder = "Select Contract",
  agreementGate = CLOSED_AGREEMENT_GATE,
}: {
  options: LinearPerp[];
  defaultSymbol?: string;
  value?: string;
  onChange?: (symbol: string) => void;
  name?: string;
  allowEmpty?: boolean;
  placeholder?: string;
  agreementGate?: BybitAgreementGate;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previewClass = useThemePreviewPortalClass();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [box, setBox] = useState({ top: 0, left: 0, width: PANEL_MIN_WIDTH });
  const [internal, setInternal] = useState(() =>
    allowEmpty ? "" : firstOpenPerp(options, agreementGate, defaultSymbol),
  );
  const symbol = value ?? internal;

  const selected = allowEmpty && !symbol
    ? undefined
    : options.find((row) => row.symbol === symbol) ??
      (allowEmpty ? undefined : options[0]);
  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) {
      return options;
    }
    return options.filter((row) => {
      const label = formatPerpPairLabel(row);
      return (
        row.symbol.includes(needle) ||
        row.baseCoin.toUpperCase().includes(needle) ||
        row.quoteCoin.toUpperCase().includes(needle) ||
        label.includes(needle) ||
        label.replace("-", "").includes(needle)
      );
    });
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!open) {
        return;
      }
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setQuery("");
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    function place() {
      const trigger = buttonRef.current;
      if (!trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, PANEL_MIN_WIDTH);
      const left = Math.max(
        PANEL_MARGIN,
        Math.min(rect.left, window.innerWidth - width - PANEL_MARGIN),
      );
      const spaceBelow = window.innerHeight - rect.bottom - PANEL_MARGIN;
      const top =
        spaceBelow < 160 && rect.top > spaceBelow
          ? Math.max(PANEL_MARGIN, rect.top - PANEL_GAP - PANEL_MAX_HEIGHT)
          : rect.bottom + PANEL_GAP;
      setBox((current) =>
        current.top === top && current.left === left && current.width === width
          ? current
          : { top, left, width },
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  if (options.length === 0) {
    return (
      <input
        name={name}
        value={value ?? (allowEmpty ? "" : defaultSymbol)}
        onChange={(event) => onChange?.(event.target.value.toUpperCase())}
        placeholder={allowEmpty ? placeholder : undefined}
        autoComplete="off"
        spellCheck={false}
        className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm uppercase text-ink focus:border-line-strong focus:outline-none"
      />
    );
  }

  function choose(next: string) {
    onChange?.(next);
    if (value === undefined) {
      setInternal(next);
    }
    setOpen(false);
    setQuery("");
  }

  const pickerNote = BYBIT_AGREEMENT_PICKER_NOTE.split("Exchanges");

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            style={{ top: box.top, left: box.left, width: box.width }}
            className={`fixed z-50 flex max-h-72 flex-col overflow-hidden rounded-card border border-line bg-surface p-2 text-ink ${previewClass}`.trim()}
          >
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const first = filtered.find(
                    (row) => !perpNeedsBybitAgreement(agreementGate, row),
                  );
                  if (first) {
                    choose(first.symbol);
                  }
                }
              }}
              placeholder={`Search ${options.length} pairs`}
              autoComplete="off"
              spellCheck={false}
              className="mb-2 w-full shrink-0 rounded-control border border-line bg-canvas px-3 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
            />
            <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-2 py-2 text-sm text-ink-muted">
                  No matching pairs
                </li>
              ) : (
                filtered.map((row) => {
                  const active = row.symbol === selected?.symbol;
                  const blocked = perpNeedsBybitAgreement(agreementGate, row);
                  const label = formatPerpPairLabel(row);
                  return (
                    <li key={row.symbol}>
                      {blocked ? (
                        <div
                          role="option"
                          aria-selected={false}
                          aria-disabled="true"
                          className="flex w-full items-start gap-3 rounded-control px-2 py-1.5 text-left text-sm"
                        >
                          <TokenIcon symbol={row.baseCoin} size={18} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">
                              {label}
                            </span>
                            <span className="block text-hint text-warning">
                              {pickerNote[0]}
                              <Link
                                href={ACCOUNT_EXCHANGES_HREF}
                                className="text-accent underline underline-offset-2 hover:text-accent-strong"
                              >
                                Exchanges
                              </Link>
                              {pickerNote[1]}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => choose(row.symbol)}
                          className={`flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left text-sm ${
                            active
                              ? "bg-surface-raised text-ink"
                              : "text-ink-muted hover:bg-surface-raised hover:text-ink"
                          }`}
                        >
                          <TokenIcon symbol={row.baseCoin} size={18} />
                          <span className="min-w-0 flex-1 truncate font-medium text-ink">
                            {label}
                          </span>
                        </button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative mt-1">
      <input type="hidden" name={name} value={selected?.symbol ?? symbol} />
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        className="flex w-full items-center gap-2 rounded-control border border-line bg-canvas px-3 py-2 text-left text-sm text-ink hover:border-line-strong focus:border-line-strong focus:outline-none"
      >
        {selected ? (
          <>
            <TokenIcon symbol={selected.baseCoin} size={18} />
            <span className="min-w-0 flex-1 truncate font-medium">
              {formatPerpPairLabel(selected)}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-ink-muted">
            {placeholder}
          </span>
        )}
        <IconChevronDown
          size={12}
          className="size-3 shrink-0 text-ink-faint"
        />
      </button>
      {panel}
    </div>
  );
}
