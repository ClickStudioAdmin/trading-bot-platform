"use client";

import { useSyncExternalStore } from "react";
import { TableColumnPicker } from "@/components/table-column-picker";
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
  hiddenColumns = [],
  align = "end",
}: {
  visible: FuturesOpenColumnVisibility;
  setColumn: (id: FuturesOpenOptionalColumn, on: boolean) => void;
  hiddenColumns?: readonly FuturesOpenOptionalColumn[];
  align?: "start" | "end";
}) {
  return (
    <TableColumnPicker
      align={align}
      visible={visible}
      onToggle={(id, on) => setColumn(id as FuturesOpenOptionalColumn, on)}
      columns={FUTURES_OPEN_OPTIONAL_COLUMNS.filter(
        (id) => !hiddenColumns.includes(id),
      ).map((id) => ({
        id,
        label: FUTURES_OPEN_COLUMN_LABELS[id],
      }))}
    />
  );
}
