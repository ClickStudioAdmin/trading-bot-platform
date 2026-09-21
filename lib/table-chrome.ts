export const TABLE_PAGE_SIZE = 20;

export type TableSortDir = "asc" | "desc";
export type StatusTone = "success" | "warning" | "danger" | "accent" | "muted";

export type TablePageWindow = {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  start: number;
  end: number;
};

export function tablePageWindow(
  total: number,
  page: number,
  pageSize = TABLE_PAGE_SIZE,
): TablePageWindow {
  const size = Math.max(1, Math.trunc(pageSize));
  const safeTotal = Math.max(0, Math.trunc(total) || 0);
  const pageCount = Math.max(1, Math.ceil(safeTotal / size) || 1);
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const start = (safePage - 1) * size;
  const end = Math.min(start + size, safeTotal);
  return {
    page: safePage,
    pageCount,
    total: safeTotal,
    from: safeTotal === 0 ? 0 : start + 1,
    to: end,
    start,
    end,
  };
}

export function tablePageLabel(input: {
  total: number;
  from: number;
  to: number;
  empty?: string;
}): string {
  if (input.total === 0) {
    return input.empty ?? "No rows.";
  }
  return `Showing ${input.from}–${input.to} of ${input.total}`;
}

export function parseTablePage(value: unknown): number {
  const page = Math.trunc(Number(String(value ?? "").trim()));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function parseTableSortDir(value: unknown): TableSortDir {
  return String(value ?? "").trim() === "desc" ? "desc" : "asc";
}

export function toggleTableSortDir(
  currentKey: string,
  nextKey: string,
  currentDir: TableSortDir,
  defaultDir: TableSortDir = "asc",
): TableSortDir {
  if (currentKey === nextKey) {
    return currentDir === "asc" ? "desc" : "asc";
  }
  return defaultDir;
}

export function compareTableText(
  left: string,
  right: string,
  dir: TableSortDir,
): number {
  return left.localeCompare(right, undefined, { numeric: true }) * (dir === "asc" ? 1 : -1);
}

export function compareTableNum(
  left: number,
  right: number,
  dir: TableSortDir,
): number {
  return (left - right) * (dir === "asc" ? 1 : -1);
}

export function sliceTablePage<T>(
  rows: readonly T[],
  page: number,
  pageSize = TABLE_PAGE_SIZE,
): { rows: T[]; window: TablePageWindow } {
  const window = tablePageWindow(rows.length, page, pageSize);
  return {
    rows: rows.slice(window.start, window.end) as T[],
    window,
  };
}

export function tableSortHref(input: {
  pathname: string;
  params?: Record<string, string | undefined | null>;
  key: string;
  currentKey: string;
  currentDir: TableSortDir;
  defaultKey?: string;
  defaultDir?: TableSortDir;
}): string {
  const dir = toggleTableSortDir(
    input.currentKey,
    input.key,
    input.currentDir,
    input.defaultDir,
  );
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(input.params ?? {})) {
    if (!value || name === "sort" || name === "dir" || name === "page") {
      continue;
    }
    params.set(name, value);
  }
  const defaultKey = input.defaultKey ?? "";
  const defaultDir = input.defaultDir ?? "asc";
  if (input.key !== defaultKey || dir !== defaultDir) {
    params.set("sort", input.key);
    if (dir !== defaultDir) {
      params.set("dir", dir);
    }
  }
  const query = params.toString();
  return query ? `${input.pathname}?${query}` : input.pathname;
}

export function parseTableSortKey<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const key = String(value ?? "").trim();
  return (allowed as readonly string[]).includes(key) ? (key as T) : fallback;
}

export function formatStatusLabel(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function statusToneFor(status: string): StatusTone {
  const key = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (
    key === "active" ||
    key === "live" ||
    key === "paid" ||
    key === "payable" ||
    key === "verified" ||
    key === "done" ||
    key === "completed" ||
    key === "success" ||
    key === "approved" ||
    key === "read" ||
    key === "info"
  ) {
    return key === "info" ? "muted" : "success";
  }
  if (
    key === "pending" ||
    key === "hold" ||
    key === "held" ||
    key === "queued" ||
    key === "running" ||
    key === "draft" ||
    key === "unread" ||
    key === "signup" ||
    key === "requested" ||
    key === "warning" ||
    key === "open" ||
    key === "unpaid" ||
    key === "closing" ||
    key === "cancelling" ||
    key === "reduce_only" ||
    key === "stop_adding"
  ) {
    return "warning";
  }
  if (
    key === "error" ||
    key === "failed" ||
    key === "invalid" ||
    key === "rejected" ||
    key === "void" ||
    key === "refunded" ||
    key === "cancelled" ||
    key === "canceled"
  ) {
    return "danger";
  }
  if (key === "disabled" || key === "archived" || key === "inactive") {
    return "muted";
  }
  return "muted";
}
