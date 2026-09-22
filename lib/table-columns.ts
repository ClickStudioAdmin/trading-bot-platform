export function parseColumnFlags<T extends string>(
  raw: unknown,
  ids: readonly T[],
  defaults: Record<T, boolean>,
): Record<T, boolean> {
  const next = { ...defaults };
  if (!raw || typeof raw !== "object") {
    return next;
  }
  const record = raw as Record<string, unknown>;
  for (const id of ids) {
    if (typeof record[id] === "boolean") {
      next[id] = record[id];
    }
  }
  return next;
}

export function parseStoredColumnFlags<T extends string>(
  raw: string | null,
  ids: readonly T[],
  defaults: Record<T, boolean>,
): Record<T, boolean> {
  if (!raw) {
    return { ...defaults };
  }
  try {
    return parseColumnFlags(JSON.parse(raw), ids, defaults);
  } catch {
    return { ...defaults };
  }
}

export function countPickedColumns(
  columns: readonly { id: string }[],
  visible: Readonly<Record<string, boolean>>,
): { selected: number; total: number } {
  return {
    total: columns.length,
    selected: columns.filter((column) => visible[column.id]).length,
  };
}

export function columnPickerLabel(
  selected: number,
  total: number,
): string {
  return `Columns (${selected} / ${total})`;
}
