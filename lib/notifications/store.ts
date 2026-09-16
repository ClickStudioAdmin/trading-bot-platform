import { createServiceClient } from "@/lib/supabase/admin";
import { INBOX_PAGE_SIZE, inboxPageWindow } from "./inbox";

export type NotificationPreferences = {
  disabledEmails: string[];
  disabledInApp: string[];
};

export type PlatformAlertSettings = {
  disabledEmails: string[];
  disabledBadges: string[];
  demoBadgeCounts: Record<string, number>;
};

export async function loadPlatformDisabledEmails(): Promise<string[]> {
  const settings = await loadPlatformAlertSettings();
  return settings.disabledEmails;
}

export async function loadPlatformAlertSettings(): Promise<PlatformAlertSettings> {
  const empty: PlatformAlertSettings = {
    disabledEmails: [],
    disabledBadges: [],
    demoBadgeCounts: {},
  };
  const supabase = createServiceClient();
  if (!supabase) {
    return empty;
  }
  const full = await supabase
    .from("platform_settings")
    .select("disabled_emails, disabled_badges, demo_badge_counts")
    .eq("id", "tbp")
    .maybeSingle();
  const data =
    full.error || !full.data
      ? (
          await supabase
            .from("platform_settings")
            .select("disabled_emails")
            .eq("id", "tbp")
            .maybeSingle()
        ).data
      : full.data;
  if (!data) {
    return empty;
  }
  const row = data as {
    disabled_emails?: unknown;
    disabled_badges?: unknown;
    demo_badge_counts?: unknown;
  };
  const demo =
    row.demo_badge_counts &&
    typeof row.demo_badge_counts === "object" &&
    !Array.isArray(row.demo_badge_counts)
      ? (row.demo_badge_counts as Record<string, unknown>)
      : {};
  const demoBadgeCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(demo)) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      demoBadgeCounts[key] = Math.trunc(n);
    }
  }
  return {
    disabledEmails: Array.isArray(row.disabled_emails)
      ? row.disabled_emails.map(String)
      : [],
    disabledBadges: Array.isArray(row.disabled_badges)
      ? row.disabled_badges.map(String)
      : [],
    demoBadgeCounts,
  };
}

export async function loadNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const empty = { disabledEmails: [], disabledInApp: [] };
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return empty;
  }
  const { data } = await supabase
    .from("user_notification_preferences")
    .select("disabled_emails, disabled_in_app")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    return empty;
  }
  return {
    disabledEmails: Array.isArray(data.disabled_emails)
      ? data.disabled_emails.map(String)
      : [],
    disabledInApp: Array.isArray(data.disabled_in_app)
      ? data.disabled_in_app.map(String)
      : [],
  };
}

export async function claimEmailDispatch(
  template: string,
  entityKey: string,
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const { data, error } = await supabase.rpc("claim_email_dispatch", {
    p_template: template,
    p_entity_key: entityKey,
  });
  if (error) {
    return false;
  }
  return data === true;
}

export type UserNotification = {
  id: number;
  template: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

function parseNotificationRow(
  row: Record<string, unknown>,
): UserNotification | null {
  const id = Number(row.id);
  const title = String(row.title ?? "").trim();
  if (!Number.isFinite(id) || !title) {
    return null;
  }
  return {
    id,
    template: String(row.template ?? ""),
    title,
    body: String(row.body ?? ""),
    href: String(row.href ?? "/account/notifications"),
    readAt: typeof row.read_at === "string" ? row.read_at : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listUserNotifications(
  userId: string,
  limit = 50,
): Promise<UserNotification[]> {
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return [];
  }
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, template, title, body, href, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, Math.trunc(limit))));
  if (error || !data) {
    return [];
  }
  return data.flatMap((row) => {
    const parsed = parseNotificationRow(row as Record<string, unknown>);
    return parsed ? [parsed] : [];
  });
}

export async function listUserNotificationPage(
  userId: string,
  page: number,
  pageSize = INBOX_PAGE_SIZE,
  filters?: { status?: "unread" | "read" | ""; templates?: string[] | null },
): Promise<{
  rows: UserNotification[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
}> {
  const empty = inboxPageWindow(0, 1, pageSize);
  const templates = filters?.templates;
  if (templates && templates.length === 0) {
    return { ...empty, rows: [] };
  }
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return { ...empty, rows: [] };
  }
  const counted = applyInboxListFilters(
    supabase
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    filters,
  );
  const countedResult = await counted;
  if (countedResult.error) {
    return { ...empty, rows: [] };
  }
  const window = inboxPageWindow(countedResult.count ?? 0, page, pageSize);
  if (window.total === 0) {
    return { ...window, rows: [] };
  }
  const { data, error } = await applyInboxListFilters(
    supabase
      .from("user_notifications")
      .select("id, template, title, body, href, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(window.start, window.end - 1),
    filters,
  );
  if (error || !data) {
    return { ...window, rows: [] };
  }
  return {
    ...window,
    rows: data.flatMap((row) => {
      const parsed = parseNotificationRow(row as Record<string, unknown>);
      return parsed ? [parsed] : [];
    }),
  };
}

function applyInboxListFilters<T extends {
  is: (column: string, value: null) => T;
  not: (column: string, operator: string, value: null) => T;
  in: (column: string, values: string[]) => T;
}>(
  query: T,
  filters?: { status?: "unread" | "read" | ""; templates?: string[] | null },
): T {
  let next = query;
  if (filters?.status === "unread") {
    next = next.is("read_at", null);
  } else if (filters?.status === "read") {
    next = next.not("read_at", "is", null);
  }
  if (filters?.templates && filters.templates.length > 0) {
    next = next.in("template", filters.templates);
  }
  return next;
}

export async function countUnreadUserNotifications(
  userId: string,
): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return 0;
  }
  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function markUserNotificationsRead(
  userId: string,
  ids?: number[],
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return false;
  }
  const { error } = await supabase.rpc("mark_user_notifications_read", {
    p_user_id: userId,
    p_ids: ids && ids.length > 0 ? ids : null,
  });
  return !error;
}

export async function markUserNotificationsUnread(
  userId: string,
  ids: number[],
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase || !userId || ids.length === 0) {
    return false;
  }
  const { error } = await supabase.rpc("mark_user_notifications_unread", {
    p_user_id: userId,
    p_ids: ids,
  });
  return !error;
}

export async function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return false;
  }
  const { error } = await supabase.rpc("upsert_user_notification_preferences", {
    p_user_id: userId,
    p_disabled_emails: prefs.disabledEmails,
    p_disabled_in_app: prefs.disabledInApp,
  });
  return !error;
}

export async function savePlatformDisabledEmails(
  disabledEmails: string[],
): Promise<boolean> {
  return savePlatformAlertSettings({ disabledEmails });
}

export async function savePlatformAlertSettings(input: {
  disabledEmails?: string[];
  disabledBadges?: string[];
  demoBadgeCounts?: Record<string, number> | null;
}): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.disabledEmails) {
    patch.disabled_emails = input.disabledEmails;
  }
  if (input.disabledBadges) {
    patch.disabled_badges = input.disabledBadges;
  }
  if (input.demoBadgeCounts !== undefined) {
    patch.demo_badge_counts = input.demoBadgeCounts ?? {};
  }
  const { error } = await supabase
    .from("platform_settings")
    .update(patch)
    .eq("id", "tbp");
  return !error;
}

export async function insertUserNotification(input: {
  userId: string;
  template: string;
  title: string;
  body: string;
  href: string;
}): Promise<number | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc("insert_user_notification", {
    p_user_id: input.userId,
    p_template: input.template,
    p_title: input.title,
    p_body: input.body,
    p_href: input.href,
  });
  if (error || data == null) {
    return null;
  }
  const id = Number(data);
  return Number.isFinite(id) ? id : null;
}
