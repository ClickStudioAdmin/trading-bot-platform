import {
  emailDispatchShouldComplete,
  emailShouldSend,
  inboxShouldInsert,
  isOperatorNotificationId,
  resendConfigured,
  type NotificationId,
} from "./catalog";
import { inboxBody, inboxTitle, type NotificationNotice } from "./copy";
import {
  MEMBER_EMAIL_FOOTER,
  noticeAbsoluteHref,
  noticeEmailHtml,
  noticeEmailText,
  sendResendEmail,
} from "./email";
import { resolvePlatformEmailFrom } from "./email-from";
import { loadPlatformBrand } from "@/lib/platform/brand";
import {
  claimEmailDispatch,
  completeEmailDispatch,
  insertUserNotification,
  loadNotificationPreferences,
  loadPlatformDisabledEmails,
} from "./store";

export type NotifyResult = {
  claimed: boolean;
  inbox: boolean;
  email: "sent" | "skipped" | "unconfigured" | "failed";
};

export async function notify(input: {
  template: NotificationId;
  userId?: string | null;
  toEmail?: string | string[] | null;
  entityKey: string;
  notice: NotificationNotice;
}): Promise<NotifyResult> {
  const skipped: NotifyResult = {
    claimed: false,
    inbox: false,
    email: "skipped",
  };
  if (!input.entityKey.trim()) {
    return skipped;
  }
  const claimed = await claimEmailDispatch(input.template, input.entityKey);
  if (!claimed) {
    return skipped;
  }

  const recipients = uniqueEmails(input.toEmail);
  const platformDisabled = await loadPlatformDisabledEmails();
  const prefs = input.userId
    ? await loadNotificationPreferences(input.userId)
    : { disabledEmails: [], disabledInApp: [] };
  const [from, brand] = await Promise.all([
    resolvePlatformEmailFrom(),
    loadPlatformBrand(),
  ]);
  const configured = resendConfigured({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: from,
  });

  let inbox = false;
  if (
    claimed === "new" &&
    input.userId &&
    inboxShouldInsert({
      template: input.template,
      userDisabledInApp: prefs.disabledInApp,
    })
  ) {
    const inserted = await insertUserNotification({
      userId: input.userId,
      template: input.template,
      title: inboxTitle(input.notice),
      body: inboxBody(input.notice),
      href: input.notice.actionUrl,
    });
    inbox = inserted != null;
  }

  let email: NotifyResult["email"] = "skipped";
  const actionHref = noticeAbsoluteHref(input.notice.actionUrl);
  const footer = isOperatorNotificationId(input.template)
    ? undefined
    : MEMBER_EMAIL_FOOTER;
  for (const to of recipients) {
    const decision = emailShouldSend({
      template: input.template,
      toEmail: to,
      platformDisabled,
      userDisabledEmails: prefs.disabledEmails,
      resendConfigured: configured,
    });
    if (!decision.send) {
      if (decision.reason === "resend" && email === "skipped") {
        email = "unconfigured";
      }
      continue;
    }
    const sent = await sendResendEmail(
      {
        to,
        subject: input.notice.subject,
        html: noticeEmailHtml(input.notice, {
          footer,
          actionHref,
          logoUrl: brand.logoUrl,
          brand: brand.name,
        }),
        text: noticeEmailText(input.notice, { footer, actionHref }),
      },
      {
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        EMAIL_FROM: from,
      },
    );
    if (sent.ok) {
      email = "sent";
      continue;
    }
    console.error("resend_send_failed", input.template, sent.error);
    if (email !== "sent") {
      email = "failed";
    }
  }

  if (emailDispatchShouldComplete(email)) {
    await completeEmailDispatch(input.template, input.entityKey);
  }

  return { claimed: true, inbox, email };
}

function uniqueEmails(value: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  for (const item of raw) {
    const email = String(item ?? "")
      .trim()
      .toLowerCase();
    if (email.includes("@")) {
      seen.add(email);
    }
  }
  return [...seen];
}
