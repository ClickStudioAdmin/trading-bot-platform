"use client";

import { useSyncExternalStore } from "react";
import { TableColumnPicker } from "@/components/table-column-picker";
import {
  FUTURES_CLOSED_COLUMN_DEFAULTS,
  FUTURES_CLOSED_COLUMN_LABELS,
  FUTURES_CLOSED_COLUMNS_KEY,
  FUTURES_CLOSED_OPTIONAL_COLUMNS,
  FUTURES_OPEN_COLUMN_DEFAULTS,
  FUTURES_OPEN_COLUMN_LABELS,
  FUTURES_OPEN_COLUMNS_KEY,
  FUTURES_OPEN_OPTIONAL_COLUMNS,
  parseStoredFuturesClosedColumns,
  parseStoredFuturesOpenColumns,
  parseStoredFuturesWorkingColumns,
  FUTURES_WORKING_COLUMN_DEFAULTS,
  FUTURES_WORKING_COLUMN_LABELS,
  FUTURES_WORKING_COLUMNS_KEY,
  FUTURES_WORKING_OPTIONAL_COLUMNS,
  type FuturesClosedColumnVisibility,
  type FuturesClosedOptionalColumn,
  type FuturesOpenColumnVisibility,
  type FuturesOpenOptionalColumn,
  type FuturesWorkingColumnVisibility,
  type FuturesWorkingOptionalColumn,
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

const CLOSED_CHANGE_EVENT = "tbp-columns-change:futures-closed";

let cachedClosedRaw: string | null | undefined;
let cachedClosedVisible: FuturesClosedColumnVisibility =
  FUTURES_CLOSED_COLUMN_DEFAULTS;

function subscribeFuturesClosedColumns(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CLOSED_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CLOSED_CHANGE_EVENT, onStoreChange);
  };
}

function readFuturesClosedColumns(): FuturesClosedColumnVisibility {
  const raw = window.localStorage.getItem(FUTURES_CLOSED_COLUMNS_KEY);
  if (raw === cachedClosedRaw) {
    return cachedClosedVisible;
  }
  cachedClosedRaw = raw;
  cachedClosedVisible = parseStoredFuturesClosedColumns(raw);
  return cachedClosedVisible;
}

export function useFuturesClosedColumns() {
  const visible = useSyncExternalStore(
    subscribeFuturesClosedColumns,
    readFuturesClosedColumns,
    () => FUTURES_CLOSED_COLUMN_DEFAULTS,
  );

  function setColumn(id: FuturesClosedOptionalColumn, on: boolean) {
    const next = { ...readFuturesClosedColumns(), [id]: on };
    const raw = JSON.stringify(next);
    window.localStorage.setItem(FUTURES_CLOSED_COLUMNS_KEY, raw);
    cachedClosedRaw = raw;
    cachedClosedVisible = next;
    window.dispatchEvent(new Event(CLOSED_CHANGE_EVENT));
  }

  return { visible, setColumn };
}

export function FuturesClosedColumnPicker({
  visible,
  setColumn,
  align = "end",
}: {
  visible: FuturesClosedColumnVisibility;
  setColumn: (id: FuturesClosedOptionalColumn, on: boolean) => void;
  align?: "start" | "end";
}) {
  return (
    <TableColumnPicker
      align={align}
      visible={visible}
      onToggle={(id, on) => setColumn(id as FuturesClosedOptionalColumn, on)}
      columns={FUTURES_CLOSED_OPTIONAL_COLUMNS.map((id) => ({
        id,
        label: FUTURES_CLOSED_COLUMN_LABELS[id],
      }))}
    />
  );
}

const WORKING_CHANGE_EVENT = "tbp-columns-change:futures-working";

let cachedWorkingRaw: string | null | undefined;
let cachedWorkingVisible: FuturesWorkingColumnVisibility =
  FUTURES_WORKING_COLUMN_DEFAULTS;

function subscribeFuturesWorkingColumns(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(WORKING_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(WORKING_CHANGE_EVENT, onStoreChange);
  };
}

function readFuturesWorkingColumns(): FuturesWorkingColumnVisibility {
  const raw = window.localStorage.getItem(FUTURES_WORKING_COLUMNS_KEY);
  if (raw === cachedWorkingRaw) {
    return cachedWorkingVisible;
  }
  cachedWorkingRaw = raw;
  cachedWorkingVisible = parseStoredFuturesWorkingColumns(raw);
  return cachedWorkingVisible;
}

export function useFuturesWorkingColumns() {
  const visible = useSyncExternalStore(
    subscribeFuturesWorkingColumns,
    readFuturesWorkingColumns,
    () => FUTURES_WORKING_COLUMN_DEFAULTS,
  );

  function setColumn(id: FuturesWorkingOptionalColumn, on: boolean) {
    const next = { ...readFuturesWorkingColumns(), [id]: on };
    const raw = JSON.stringify(next);
    window.localStorage.setItem(FUTURES_WORKING_COLUMNS_KEY, raw);
    cachedWorkingRaw = raw;
    cachedWorkingVisible = next;
    window.dispatchEvent(new Event(WORKING_CHANGE_EVENT));
  }

  return { visible, setColumn };
}

export function FuturesWorkingColumnPicker({
  visible,
  setColumn,
  hiddenColumns = [],
  align = "end",
}: {
  visible: FuturesWorkingColumnVisibility;
  setColumn: (id: FuturesWorkingOptionalColumn, on: boolean) => void;
  hiddenColumns?: readonly FuturesWorkingOptionalColumn[];
  align?: "start" | "end";
}) {
  return (
    <TableColumnPicker
      align={align}
      visible={visible}
      onToggle={(id, on) => setColumn(id as FuturesWorkingOptionalColumn, on)}
      columns={FUTURES_WORKING_OPTIONAL_COLUMNS.filter(
        (id) => !hiddenColumns.includes(id),
      ).map((id) => ({
        id,
        label: FUTURES_WORKING_COLUMN_LABELS[id],
      }))}
    />
  );
}
