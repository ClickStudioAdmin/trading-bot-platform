"use client";

import { useSyncExternalStore } from "react";
import { TableColumnPicker } from "@/components/table-column-picker";
import {
  PAPER_CLOSED_COLUMN_DEFAULTS,
  PAPER_CLOSED_COLUMN_LABELS,
  PAPER_CLOSED_COLUMNS_KEY,
  PAPER_CLOSED_OPTIONAL_COLUMNS,
  PAPER_OPEN_COLUMN_DEFAULTS,
  PAPER_OPEN_COLUMN_LABELS,
  PAPER_OPEN_COLUMNS_KEY,
  PAPER_OPEN_OPTIONAL_COLUMNS,
  parseStoredPaperClosedColumns,
  parseStoredPaperOpenColumns,
  type PaperClosedColumnVisibility,
  type PaperClosedOptionalColumn,
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

const CLOSED_CHANGE_EVENT = "tbp-columns-change:paper-closed";

let cachedClosedRaw: string | null | undefined;
let cachedClosedVisible: PaperClosedColumnVisibility =
  PAPER_CLOSED_COLUMN_DEFAULTS;

function subscribePaperClosedColumns(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CLOSED_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CLOSED_CHANGE_EVENT, onStoreChange);
  };
}

function readPaperClosedColumns(): PaperClosedColumnVisibility {
  const raw = window.localStorage.getItem(PAPER_CLOSED_COLUMNS_KEY);
  if (raw === cachedClosedRaw) {
    return cachedClosedVisible;
  }
  cachedClosedRaw = raw;
  cachedClosedVisible = parseStoredPaperClosedColumns(raw);
  return cachedClosedVisible;
}

export function usePaperClosedColumns() {
  const visible = useSyncExternalStore(
    subscribePaperClosedColumns,
    readPaperClosedColumns,
    () => PAPER_CLOSED_COLUMN_DEFAULTS,
  );

  function setColumn(id: PaperClosedOptionalColumn, on: boolean) {
    const next = { ...readPaperClosedColumns(), [id]: on };
    const raw = JSON.stringify(next);
    window.localStorage.setItem(PAPER_CLOSED_COLUMNS_KEY, raw);
    cachedClosedRaw = raw;
    cachedClosedVisible = next;
    window.dispatchEvent(new Event(CLOSED_CHANGE_EVENT));
  }

  return { visible, setColumn };
}

export function PaperClosedColumnPicker({
  visible,
  setColumn,
  align = "end",
}: {
  visible: PaperClosedColumnVisibility;
  setColumn: (id: PaperClosedOptionalColumn, on: boolean) => void;
  align?: "start" | "end";
}) {
  return (
    <TableColumnPicker
      align={align}
      visible={visible}
      onToggle={(id, on) => setColumn(id as PaperClosedOptionalColumn, on)}
      columns={PAPER_CLOSED_OPTIONAL_COLUMNS.map((id) => ({
        id,
        label: PAPER_CLOSED_COLUMN_LABELS[id],
      }))}
    />
  );
}
