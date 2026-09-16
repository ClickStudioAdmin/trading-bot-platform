import { firstSearchValue } from "@/lib/paper/open";
import { isNotificationId, type NotificationId } from "./catalog";
import type { NotificationSettingGroup } from "./settings";

export const INBOX_PATH = "/account/notifications";
export const INBOX_PAGE_SIZE = 20;
export const INBOX_STATUSES = ["unread", "read"] as const;

export type InboxStatus = "" | (typeof INBOX_STATUSES)[number];

export type InboxFilters = {
  status: InboxStatus;
  scope: string;
  event: string;
};

export const EMPTY_INBOX_FILTERS: InboxFilters = {
  status: "",
  scope: "",
  event: "",
};

export function parseInboxPage(value: unknown): number {
  const page = Math.trunc(Number(String(value ?? "").trim()));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function parseInboxStatus(value: unknown): InboxStatus {
  const status = String(value ?? "").trim();
  return INBOX_STATUSES.includes(status as (typeof INBOX_STATUSES)[number])
    ? (status as InboxStatus)
    : "";
}

export function parseInboxFilters(
  params: Record<string, string | string[] | undefined>,
  groups: readonly NotificationSettingGroup[],
): InboxFilters {
  const allowedScopes = new Set(groups.map((group) => group.id));
  const allowedEvents = new Set(groups.flatMap((group) => group.ids));
  const scope = (firstSearchValue(params.scope) ?? "").trim();
  const event = (firstSearchValue(params.event) ?? "").trim();
  return {
    status: parseInboxStatus(firstSearchValue(params.status)),
    scope: allowedScopes.has(scope) ? scope : "",
    event:
      isNotificationId(event) && allowedEvents.has(event) ? event : "",
  };
}

export function inboxHasFilters(filters: InboxFilters): boolean {
  return Boolean(filters.status || filters.scope || filters.event);
}

export function inboxFilterTemplates(
  filters: InboxFilters,
  groups: readonly NotificationSettingGroup[],
): NotificationId[] | null {
  const group = groups.find((row) => row.id === filters.scope) ?? null;
  if (filters.scope && !group) {
    return [];
  }
  if (filters.event) {
    if (!isNotificationId(filters.event)) {
      return [];
    }
    if (group && !group.ids.includes(filters.event)) {
      return [];
    }
    return [filters.event];
  }
  return group ? [...group.ids] : null;
}

export function inboxPageWindow(
  total: number,
  page: number,
  pageSize = INBOX_PAGE_SIZE,
): {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  start: number;
  end: number;
} {
  const size = Math.max(1, Math.trunc(pageSize));
  const safeTotal = Math.max(0, Math.trunc(total) || 0);
  const pageCount = Math.max(1, Math.ceil(safeTotal / size));
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

export function inboxPageLabel(input: {
  total: number;
  from: number;
  to: number;
}): string {
  if (input.total === 0) {
    return "No notices.";
  }
  return `Showing ${input.from}–${input.to} of ${input.total}`;
}

export function inboxPath(page = 1, filters: InboxFilters = EMPTY_INBOX_FILTERS): string {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.scope) {
    params.set("scope", filters.scope);
  }
  if (filters.event) {
    params.set("event", filters.event);
  }
  const safe = parseInboxPage(page);
  if (safe > 1) {
    params.set("page", String(safe));
  }
  const query = params.toString();
  return query ? `${INBOX_PATH}?${query}` : INBOX_PATH;
}
