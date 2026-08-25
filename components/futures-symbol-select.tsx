"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TokenIcon } from "@/components/token-icon";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";

export function FuturesSymbolSelect({
  options,
  defaultSymbol = "BTCUSDT",
  value,
  onChange,
}: {
  options: LinearPerp[];
  defaultSymbol?: string;
  value?: string;
  onChange?: (symbol: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [internal, setInternal] = useState(() =>
    pickDefault(options, defaultSymbol),
  );
  const symbol = value ?? internal;

  const selected = options.find((row) => row.symbol === symbol) ?? options[0];
  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) {
      return options;
    }
    return options.filter(
      (row) =>
        row.symbol.includes(needle) || row.baseCoin.toUpperCase().includes(needle),
    );
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!open) {
        return;
      }
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
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

  if (options.length === 0) {
    return (
      <input
        name="symbol"
        defaultValue={value ?? defaultSymbol}
        onChange={(event) => onChange?.(event.target.value.toUpperCase())}
        autoComplete="off"
        spellCheck={false}
        className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm uppercase text-ink focus:border-line-strong focus:outline-none"
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

  return (
    <div ref={rootRef} className="relative mt-1">
      <input type="hidden" name="symbol" value={selected?.symbol ?? symbol} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        className="flex w-full items-center gap-2 rounded-control border border-line bg-surface-raised px-3 py-2 text-left text-sm text-ink hover:border-line-strong focus:border-line-strong focus:outline-none"
      >
        {selected ? (
          <>
            <TokenIcon symbol={selected.baseCoin} size={18} />
            <span className="min-w-0 truncate font-medium">{selected.symbol}</span>
          </>
        ) : (
          <span className="text-ink-muted">Select a pair</span>
        )}
        <svg
          viewBox="0 0 12 12"
          className="ml-auto size-3 shrink-0 text-ink-faint"
          aria-hidden
        >
          <path
            d="M3 4.5 6 8l3-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] rounded-card border border-line bg-surface p-2">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const first = filtered[0];
                if (first) {
                  choose(first.symbol);
                }
              }
            }}
            placeholder={`Search ${options.length} pairs`}
            autoComplete="off"
            spellCheck={false}
            className="mb-2 w-full rounded-control border border-line bg-surface-raised px-3 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
          />
          <ul role="listbox" className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-ink-muted">No matching pairs</li>
            ) : (
              filtered.map((row) => {
                const active = row.symbol === selected?.symbol;
                return (
                  <li
                    key={row.symbol}
                    style={{
                      contentVisibility: "auto",
                      containIntrinsicSize: "0 36px",
                    }}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => choose(row.symbol)}
                      className={`flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm ${
                        active
                          ? "bg-surface-raised text-ink"
                          : "text-ink-muted hover:bg-surface-raised hover:text-ink"
                      }`}
                    >
                      <TokenIcon symbol={row.baseCoin} size={18} />
                      <span className="min-w-0 truncate font-medium text-ink">
                        {row.symbol}
                      </span>
                      {row.baseCoin !== row.symbol.replace(/USDT$/, "") ? (
                        <span className="ml-auto shrink-0 text-xs text-ink-faint">
                          {row.baseCoin}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function pickDefault(options: LinearPerp[], preferred: string): string {
  if (options.some((row) => row.symbol === preferred)) {
    return preferred;
  }
  return options[0]?.symbol ?? preferred;
}
