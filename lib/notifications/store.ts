import { createServiceClient } from "@/lib/supabase/admin";

export type NotificationPreferences = {
  disabledEmails: string[];
  disabledInApp: string[];
};

export async function loadPlatformDisabledEmails(): Promise<string[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data } = await supabase
    .from("platform_settings")
    .select("disabled_emails")
    .eq("id", "tbp")
    .maybeSingle();
  return Array.isArray(data?.disabled_emails)
    ? data.disabled_emails.map(String)
    : [];
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
    const id = Number(row.id);
    const title = String(row.title ?? "").trim();
    if (!Number.isFinite(id) || !title) {
      return [];
    }
    return [
      {
        id,
        template: String(row.template ?? ""),
        title,
        body: String(row.body ?? ""),
        href: String(row.href ?? "/account/notifications"),
        readAt: typeof row.read_at === "string" ? row.read_at : null,
        createdAt: String(row.created_at ?? ""),
      },
    ];
  });
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
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const { error } = await supabase
    .from("platform_settings")
    .update({
      disabled_emails: disabledEmails,
      updated_at: new Date().toISOString(),
    })
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
