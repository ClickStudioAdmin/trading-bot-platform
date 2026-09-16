export const INBOX_PATH = "/account/notifications";
export const INBOX_PAGE_SIZE = 20;

export function parseInboxPage(value: unknown): number {
  const page = Math.trunc(Number(String(value ?? "").trim()));
  return Number.isFinite(page) && page > 0 ? page : 1;
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

export function inboxPath(page = 1): string {
  const safe = parseInboxPage(page);
  return safe > 1 ? `${INBOX_PATH}?page=${safe}` : INBOX_PATH;
}
