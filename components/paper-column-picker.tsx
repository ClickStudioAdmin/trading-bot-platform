"use client";

import { useSyncExternalStore } from "react";
import { TableColumnPicker } from "@/components/table-column-picker";
import {
  PAPER_OPEN_COLUMN_DEFAULTS,
  PAPER_OPEN_COLUMN_LABELS,
  PAPER_OPEN_COLUMNS_KEY,
  PAPER_OPEN_OPTIONAL_COLUMNS,
  parseStoredPaperOpenColumns,
  type PaperOpenColumnVisibility,
  type PaperOpenOptionalColumn,
} from "@/lib/paper/columns";

const COLUMN_CHANGE_EVENT = "tbp-columns-change:paper-open";

let cachedRaw: string | null | undefined;
let cachedVisible: PaperOpenColumnVisibility = PAPER_OPEN_COLUMN_DEFAULTS;

function subscribePaperOpenColumns(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(COLUMN_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(COLUMN_CHANGE_EVENT, onStoreChange);
  };
}

function readPaperOpenColumns(): PaperOpenColumnVisibility {
  const raw = window.localStorage.getItem(PAPER_OPEN_COLUMNS_KEY);
  if (raw === cachedRaw) {
    return cachedVisible;
  }
  cachedRaw = raw;
  cachedVisible = parseStoredPaperOpenColumns(raw);
  return cachedVisible;
}

export function usePaperOpenColumns() {
  const visible = useSyncExternalStore(
    subscribePaperOpenColumns,
    readPaperOpenColumns,
    () => PAPER_OPEN_COLUMN_DEFAULTS,
  );

  function setColumn(id: PaperOpenOptionalColumn, on: boolean) {
    const next = { ...readPaperOpenColumns(), [id]: on };
    const raw = JSON.stringify(next);
    window.localStorage.setItem(PAPER_OPEN_COLUMNS_KEY, raw);
    cachedRaw = raw;
    cachedVisible = next;
    window.dispatchEvent(new Event(COLUMN_CHANGE_EVENT));
  }

  return { visible, setColumn };
}

export function PaperOpenColumnPicker({
  visible,
  setColumn,
  align = "end",
}: {
  visible: PaperOpenColumnVisibility;
  setColumn: (id: PaperOpenOptionalColumn, on: boolean) => void;
  align?: "start" | "end";
}) {
  return (
    <TableColumnPicker
      align={align}
      visible={visible}
      onToggle={(id, on) => setColumn(id as PaperOpenOptionalColumn, on)}
      columns={PAPER_OPEN_OPTIONAL_COLUMNS.map((id) => ({
        id,
        label: PAPER_OPEN_COLUMN_LABELS[id],
      }))}
    />
  );
}
