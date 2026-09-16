import {
  deskIdFromHref,
  hrefPathname,
  isDeskScopedPath,
  pathWithDesk,
} from "@/lib/accounts/model";
import { INBOX_PATH } from "./inbox";

export const DESK_NOTICE_TEMPLATES = [
  "desk_sync_failed",
  "desk_order_failed",
] as const;

export function safeNoticeHref(value: unknown): string {
  const href = String(value ?? "").trim();
  if (href.startsWith("/") && !href.startsWith("//")) {
    return href;
  }
  return INBOX_PATH;
}

export function deskNameFromNoticeTitle(title: string): string | null {
  const parts = title.split(" — ");
  if (parts.length < 2) {
    return null;
  }
  const name = parts.slice(1).join(" — ").trim();
  return name || null;
}

function matchDeskByName<T extends { name: string }>(
  desks: readonly T[],
  name: string | null,
): T | null {
  if (!name) {
    return null;
  }
  const needle = name.toLowerCase();
  return desks.find((desk) => desk.name.toLowerCase() === needle) ?? null;
}

export function activityPathForDeskType(deskType: string): string {
  return deskType === "cash_and_carry"
    ? "/strategies/cash-and-carry/activity"
    : "/strategies/futures/activity";
}

export function resolveInboxHref(input: {
  href: string;
  title: string;
  template?: string;
  desks: readonly { id: string; name: string; deskType: string }[];
}): string {
  const href = safeNoticeHref(input.href);
  const pathname = hrefPathname(href);
  const deskNotice =
    input.template != null &&
    (DESK_NOTICE_TEMPLATES as readonly string[]).includes(input.template);
  const named = deskNotice
    ? matchDeskByName(input.desks, deskNameFromNoticeTitle(input.title))
    : null;
  if (deskNotice) {
    const desk = named ?? deskForPath(pathname, input.desks);
    if (!desk) {
      return pathname;
    }
    return pathWithDesk(activityPathForDeskType(desk.deskType), desk.id);
  }
  if (!isDeskScopedPath(pathname)) {
    return href;
  }
  const existing = deskIdFromHref(href);
  if (existing && input.desks.some((desk) => desk.id === existing)) {
    return pathWithDesk(pathname, existing);
  }
  const desk = named ?? deskForPath(pathname, input.desks);
  if (!desk) {
    return pathname;
  }
  return pathWithDesk(pathname, desk.id);
}

function deskForPath(
  pathname: string,
  desks: readonly { id: string; name: string; deskType: string }[],
): { id: string; name: string; deskType: string } | null {
  const wantsCash = pathname.startsWith("/strategies/cash-and-carry");
  return (
    desks.find((desk) =>
      wantsCash
        ? desk.deskType === "cash_and_carry"
        : desk.deskType !== "cash_and_carry",
    ) ??
    desks[0] ??
    null
  );
}
