"use client";

import { useSyncExternalStore } from "react";
import { TableColumnPicker } from "@/components/table-column-picker";
import {
  AUTOMATIONS_COLUMN_DEFAULTS,
  AUTOMATIONS_COLUMN_LABELS,
  AUTOMATIONS_COLUMNS_KEY,
  AUTOMATIONS_OPTIONAL_COLUMNS,
  parseStoredAutomationsColumns,
  type AutomationsColumnVisibility,
  type AutomationsOptionalColumn,
} from "@/lib/bots/automations-columns";

const COLUMN_CHANGE_EVENT = "tbp-columns-change:automations-bots";

let cachedRaw: string | null | undefined;
let cachedVisible: AutomationsColumnVisibility = AUTOMATIONS_COLUMN_DEFAULTS;

function subscribeAutomationsColumns(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(COLUMN_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(COLUMN_CHANGE_EVENT, onStoreChange);
  };
}

function readAutomationsColumns(): AutomationsColumnVisibility {
  const raw = window.localStorage.getItem(AUTOMATIONS_COLUMNS_KEY);
  if (raw === cachedRaw) {
    return cachedVisible;
  }
  cachedRaw = raw;
  cachedVisible = parseStoredAutomationsColumns(raw);
  return cachedVisible;
}

export function useAutomationsColumns() {
  const visible = useSyncExternalStore(
    subscribeAutomationsColumns,
    readAutomationsColumns,
    () => AUTOMATIONS_COLUMN_DEFAULTS,
  );

  function setColumn(id: AutomationsOptionalColumn, on: boolean) {
    const next = { ...readAutomationsColumns(), [id]: on };
    const raw = JSON.stringify(next);
    window.localStorage.setItem(AUTOMATIONS_COLUMNS_KEY, raw);
    cachedRaw = raw;
    cachedVisible = next;
    window.dispatchEvent(new Event(COLUMN_CHANGE_EVENT));
  }

  return { visible, setColumn };
}

export function AutomationsColumnPicker({
  visible,
  setColumn,
  align = "end",
}: {
  visible: AutomationsColumnVisibility;
  setColumn: (id: AutomationsOptionalColumn, on: boolean) => void;
  align?: "start" | "end";
}) {
  return (
    <TableColumnPicker
      align={align}
      visible={visible}
      onToggle={(id, on) => setColumn(id as AutomationsOptionalColumn, on)}
      columns={AUTOMATIONS_OPTIONAL_COLUMNS.map((id) => ({
        id,
        label: AUTOMATIONS_COLUMN_LABELS[id],
      }))}
    />
  );
}
