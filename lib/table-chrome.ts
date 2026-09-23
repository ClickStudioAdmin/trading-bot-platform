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

export function tablePageForIndex(
  index: number,
  pageSize = TABLE_PAGE_SIZE,
): number {
  if (index < 0) {
    return 1;
  }
  const size = Math.max(1, Math.trunc(pageSize));
  return Math.floor(index / size) + 1;
}

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

export type TablePagerItem = number | "gap";

/** Page buttons: every page when there are seven or fewer, otherwise the ends plus the pages around the current one. */
export function tablePagerItems(page: number, pageCount: number): TablePagerItem[] {
  const count = Math.max(1, Math.trunc(pageCount) || 1);
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), count);
  if (count <= 7) {
    return Array.from({ length: count }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, count, current, current - 1, current + 1]);
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= count - 2) {
    pages.add(count - 1);
    pages.add(count - 2);
    pages.add(count - 3);
  }
  const sorted = [...pages]
    .filter((item) => item >= 1 && item <= count)
    .sort((left, right) => left - right);
  const items: TablePagerItem[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index]!;
    const previous = sorted[index - 1];
    if (previous != null && item - previous > 1) {
      items.push("gap");
    }
    items.push(item);
  }
  return items;
}

/** Plain page-number URLs for a server page to pass into the client pager. */
export function tablePageHrefs(
  page: number,
  pageCount: number,
  hrefFor: (page: number) => string,
): Record<number, string> {
  const hrefs: Record<number, string> = {};
  for (const item of tablePagerItems(page, pageCount)) {
    if (typeof item === "number" && item !== page) {
      hrefs[item] = hrefFor(item);
    }
  }
  return hrefs;
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
    key === "enabled" ||
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

export const TABLE_FILTER_CHROME_KEYS = new Set([
  "desk",
  "page",
  "sort",
  "dir",
  "tab",
  "view",
  "venue",
  "env",
  "kind",
  "saved",
  "error",
  "notice",
  "edit",
  "clone",
  "reduce",
  "created",
  "updated",
  "paper",
  "paperError",
  "bot",
  "from",
  "focus",
]);

export function tableFiltersOpenStorageKey(input: {
  pathname: string;
  tab?: string | null;
  view?: string | null;
  id?: string | null;
}): string {
  const path = input.pathname.replace(/\/+$/, "") || "/";
  const parts = [path];
  const tab = String(input.tab ?? "").trim();
  const view = String(input.view ?? "").trim();
  const id = String(input.id ?? "").trim();
  if (tab) {
    parts.push(`tab=${tab}`);
  }
  if (view) {
    parts.push(`view=${view}`);
  }
  if (id) {
    parts.push(`id=${id}`);
  }
  return `tbp.ui.table-filters:${parts.join("|")}`;
}

export function tableFiltersOpenScopeFromSearch(
  pathname: string,
  search: string,
  id?: string | null,
): string {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  return tableFiltersOpenStorageKey({
    pathname,
    tab: params.get("tab"),
    view: params.get("view"),
    id,
  });
}

export function tableFiltersSuggestOpen(
  search:
    | URLSearchParams
    | Record<string, string | string[] | undefined | null>
    | null
    | undefined,
): boolean {
  if (!search) {
    return false;
  }
  const entries =
    search instanceof URLSearchParams
      ? [...search.entries()]
      : Object.entries(search).flatMap(([key, value]) => {
          if (value == null) {
            return [];
          }
          return Array.isArray(value)
            ? value.map((item) => [key, item] as const)
            : [[key, value] as const];
        });
  for (const [key, value] of entries) {
    if (TABLE_FILTER_CHROME_KEYS.has(key)) {
      continue;
    }
    if (String(value).trim() !== "") {
      return true;
    }
  }
  return false;
}
