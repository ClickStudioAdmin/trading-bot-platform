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
