"use server";

import { requireAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  emailIsMuteable,
  isNotificationId,
  memberNotificationIds,
  NOTIFICATION_IDS,
} from "./catalog";
import {
  markUserNotificationsRead,
  markUserNotificationsUnread,
  saveNotificationPreferences,
  savePlatformDisabledEmails,
} from "./store";

function safeNoticeHref(value: unknown): string {
  const href = String(value ?? "").trim();
  if (href.startsWith("/") && !href.startsWith("//")) {
    return href;
  }
  return "/account/notifications";
}

function parseIds(formData: FormData): number[] {
  return formData
    .getAll("id")
    .map((value) => Number(value))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function requireMember() {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  return member;
}

function refreshNoticePaths() {
  revalidatePath("/", "layout");
  revalidatePath("/account/notifications");
  revalidatePath("/account");
  revalidatePath("/account/settings");
}

export async function markNotificationsReadAction(formData: FormData) {
  const member = await requireMember();
  const ids = parseIds(formData);
  const all = formData.get("all") === "1";
  await markUserNotificationsRead(member.id, all ? undefined : ids);
  refreshNoticePaths();
  const next = formData.get("next");
  if (typeof next === "string" && next.trim()) {
    redirect(safeNoticeHref(next));
  }
}

export async function markNotificationsUnreadAction(formData: FormData) {
  const member = await requireMember();
  await markUserNotificationsUnread(member.id, parseIds(formData));
  refreshNoticePaths();
}

export async function saveMemberNotificationPrefsAction(formData: FormData) {
  const member = await requireMember();
  const ids = memberNotificationIds(!member.platformMember);
  const enabledEmail = new Set(formData.getAll("email").map(String));
  const enabledInApp = new Set(formData.getAll("inapp").map(String));
  const disabledEmails = ids.filter(
    (id) => emailIsMuteable(id) && !enabledEmail.has(id),
  );
  const disabledInApp = ids.filter((id) => !enabledInApp.has(id));
  const saved = await saveNotificationPreferences(member.id, {
    disabledEmails,
    disabledInApp,
  });
  if (!saved) {
    redirect("/account/settings?tab=notifications&error=notifications");
  }
  refreshNoticePaths();
  redirect("/account/settings?tab=notifications&saved=notifications");
}

export async function savePlatformNotificationEmailsAction(formData: FormData) {
  await requireAdmin();
  const enabled = new Set(
    formData
      .getAll("email")
      .map(String)
      .filter(isNotificationId),
  );
  const disabledEmails = NOTIFICATION_IDS.filter((id) => !enabled.has(id));
  const saved = await savePlatformDisabledEmails(disabledEmails);
  if (!saved) {
    redirect("/admin/settings?tab=notifications&error=notifications");
  }
  revalidatePath("/admin/settings");
  redirect("/admin/settings?tab=notifications&saved=1");
}
