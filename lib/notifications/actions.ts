"use server";

import { requireAdmin } from "@/lib/admin/access";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  emailIsMuteable,
  isNotificationId,
  isOperatorNotificationId,
  memberNotificationIds,
  NOTIFICATION_IDS,
  resendConfigured,
} from "./catalog";
import { sampleNotice } from "./copy";
import {
  MEMBER_EMAIL_FOOTER,
  noticeAbsoluteHref,
  noticeEmailHtml,
  noticeEmailText,
  sendResendEmail,
} from "./email";
import { parseMailbox, resolvePlatformEmailFrom } from "./email-from";
import {
  BADGE_IDS,
  demoBadgesAllowed,
  isBadgeId,
  SAMPLE_BADGE_COUNTS,
} from "./badges-catalog";
import { safeNoticeHref } from "./hrefs";
import {
  inboxPath,
  markReadSelection,
  parseInboxFilters,
  parseInboxPage,
} from "./inbox";
import { memberSettingGroups } from "./settings";
import { seedUserInbox } from "./seed";
import {
  markUserNotificationsRead,
  markUserNotificationsUnread,
  saveNotificationPreferences,
  savePlatformAlertSettings,
} from "./store";

function inboxReturnPath(formData: FormData, affiliateOnly: boolean): string {
  return inboxPath(
    parseInboxPage(formData.get("page")),
    parseInboxFilters(
      {
        status: String(formData.get("status") ?? ""),
        scope: String(formData.get("scope") ?? ""),
        event: String(formData.get("event") ?? ""),
      },
      memberSettingGroups(affiliateOnly),
    ),
  );
}

function parseIds(formData: FormData): number[] {
  return formData
    .getAll("id")
    .map((value) => Number(value))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function requireMember() {
  return requireVerifiedEmail();
}

function refreshNoticePaths() {
  revalidatePath("/", "layout");
  revalidatePath("/account/notifications");
  revalidatePath("/account");
  revalidatePath("/account/settings");
}

export async function markNotificationsReadAction(formData: FormData) {
  const member = await requireMember();
  const selection = markReadSelection(
    formData.get("all") === "1",
    parseIds(formData),
  );
  if (selection === "all") {
    await markUserNotificationsRead(member.id);
  } else if (selection) {
    await markUserNotificationsRead(member.id, selection);
  }
  refreshNoticePaths();
  const next = formData.get("next");
  if (typeof next === "string" && next.trim()) {
    redirect(safeNoticeHref(next));
  }
  redirect(inboxReturnPath(formData, !member.platformMember));
}

export async function markNotificationsUnreadAction(formData: FormData) {
  const member = await requireMember();
  await markUserNotificationsUnread(member.id, parseIds(formData));
  refreshNoticePaths();
  redirect(inboxReturnPath(formData, !member.platformMember));
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

export async function savePlatformChannelSettingsAction(formData: FormData) {
  await requireAdmin();
  const enabledEmail = new Set(
    formData.getAll("email").map(String).filter(isNotificationId),
  );
  const enabledBadge = new Set(
    formData.getAll("badge").map(String).filter(isBadgeId),
  );
  const disabledEmails = NOTIFICATION_IDS.filter((id) => !enabledEmail.has(id));
  const disabledBadges = BADGE_IDS.filter((id) => !enabledBadge.has(id));
  const saved = await savePlatformAlertSettings({
    disabledEmails,
    disabledBadges,
  });
  if (!saved) {
    redirect("/admin/settings?tab=notifications&error=notifications");
  }
  refreshAdminAlertPaths();
  redirect("/admin/settings?tab=notifications&saved=1");
}

export async function seedAdminInboxAction() {
  const admin = await requireAdmin();
  if (!demoBadgesAllowed()) {
    redirect("/admin/settings?tab=notifications&error=seed");
  }
  const inserted = await seedUserInbox(admin.id);
  const demoSaved = await savePlatformAlertSettings({
    demoBadgeCounts: SAMPLE_BADGE_COUNTS,
  });
  if (inserted === 0 && !demoSaved) {
    redirect("/admin/settings?tab=notifications&error=seed");
  }
  refreshAdminAlertPaths();
  redirect("/admin/settings?tab=notifications&saved=seeded");
}

export async function sendTestEmailAction(formData: FormData) {
  const admin = await requireAdmin();
  const to =
    parseMailbox(formData.get("to")) ?? parseMailbox(admin.email);
  const template = String(formData.get("templateId") ?? "");
  if (!to) {
    redirect("/admin/email-templates?error=to");
  }
  if (!isNotificationId(template)) {
    redirect("/admin/email-templates?error=template");
  }
  const from = await resolvePlatformEmailFrom();
  if (
    !resendConfigured({
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: from,
    })
  ) {
    redirect("/admin/email-templates?error=unconfigured");
  }
  const notice = sampleNotice(template);
  const actionHref = noticeAbsoluteHref(notice.actionUrl);
  const footer = isOperatorNotificationId(template)
    ? undefined
    : MEMBER_EMAIL_FOOTER;
  const sent = await sendResendEmail(
    {
      to,
      subject: notice.subject,
      html: noticeEmailHtml(notice, { footer, actionHref }),
      text: noticeEmailText(notice, { footer, actionHref }),
    },
    {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: from,
    },
  );
  if (!sent.ok) {
    redirect("/admin/email-templates?error=send");
  }
  revalidatePath("/admin/email-templates");
  redirect("/admin/email-templates?sent=1");
}

export async function clearDemoBadgeCountsAction() {
  await requireAdmin();
  if (!demoBadgesAllowed()) {
    redirect("/admin/settings?tab=notifications&error=demo");
  }
  const saved = await savePlatformAlertSettings({ demoBadgeCounts: {} });
  if (!saved) {
    redirect("/admin/settings?tab=notifications&error=demo");
  }
  refreshAdminAlertPaths();
  redirect("/admin/settings?tab=notifications&saved=demo-cleared");
}

function refreshAdminAlertPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/account/notifications");
  revalidatePath("/account");
  revalidatePath("/admin");
}
