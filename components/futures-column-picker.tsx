"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  FUTURES_OPEN_COLUMN_DEFAULTS,
  FUTURES_OPEN_COLUMN_LABELS,
  FUTURES_OPEN_COLUMNS_KEY,
  FUTURES_OPEN_OPTIONAL_COLUMNS,
  parseStoredFuturesOpenColumns,
  type FuturesOpenColumnVisibility,
  type FuturesOpenOptionalColumn,
} from "@/lib/futures/columns";

const COLUMN_CHANGE_EVENT = "tbp-columns-change:futures-open";

let cachedRaw: string | null | undefined;
let cachedVisible: FuturesOpenColumnVisibility = FUTURES_OPEN_COLUMN_DEFAULTS;

function subscribeFuturesOpenColumns(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(COLUMN_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(COLUMN_CHANGE_EVENT, onStoreChange);
  };
}

function readFuturesOpenColumns(): FuturesOpenColumnVisibility {
  const raw = window.localStorage.getItem(FUTURES_OPEN_COLUMNS_KEY);
  if (raw === cachedRaw) {
    return cachedVisible;
  }
  cachedRaw = raw;
  cachedVisible = parseStoredFuturesOpenColumns(raw);
  return cachedVisible;
}

export function useFuturesOpenColumns() {
  const visible = useSyncExternalStore(
    subscribeFuturesOpenColumns,
    readFuturesOpenColumns,
    () => FUTURES_OPEN_COLUMN_DEFAULTS,
  );

  function setColumn(id: FuturesOpenOptionalColumn, on: boolean) {
    const next = { ...readFuturesOpenColumns(), [id]: on };
    const raw = JSON.stringify(next);
    window.localStorage.setItem(FUTURES_OPEN_COLUMNS_KEY, raw);
    cachedRaw = raw;
    cachedVisible = next;
    window.dispatchEvent(new Event(COLUMN_CHANGE_EVENT));
  }

  return { visible, setColumn };
}

export function FuturesOpenColumnPicker({
  visible,
  setColumn,
}: {
  visible: FuturesOpenColumnVisibility;
  setColumn: (id: FuturesOpenOptionalColumn, on: boolean) => void;
}) {
  const rootRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeMenu() {
      if (rootRef.current) {
        rootRef.current.open = false;
      }
    }
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root?.open) {
        return;
      }
      if (!root.contains(event.target as Node)) {
        closeMenu();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={rootRef} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink [&::-webkit-details-marker]:hidden">
        Columns
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-56 rounded-card border border-line bg-surface p-2">
        <p className="px-2 pt-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          Show columns
        </p>
        {FUTURES_OPEN_OPTIONAL_COLUMNS.map((id) => (
          <label
            key={id}
            className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-ink hover:bg-surface-raised"
          >
            <input
              type="checkbox"
              checked={visible[id]}
              onChange={(event) => setColumn(id, event.target.checked)}
              className="mt-0.5"
            />
            {FUTURES_OPEN_COLUMN_LABELS[id]}
          </label>
        ))}
      </div>
    </details>
  );
}
