import {
  emailShouldSend,
  inboxShouldInsert,
  resendConfigured,
  type NotificationId,
} from "./catalog";
import { inboxBody, inboxTitle, type NotificationNotice } from "./copy";
import {
  claimEmailDispatch,
  insertUserNotification,
  loadNotificationPreferences,
  loadPlatformDisabledEmails,
} from "./store";

export type NotifyResult = {
  claimed: boolean;
  inbox: boolean;
  email: "sent" | "skipped" | "unconfigured";
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
  const configured = resendConfigured();

  let inbox = false;
  if (
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
  for (const to of recipients) {
    const decision = emailShouldSend({
      template: input.template,
      toEmail: to,
      platformDisabled,
      userDisabledEmails: prefs.disabledEmails,
      resendConfigured: configured,
    });
    if (!decision.send) {
      if (decision.reason === "resend") {
        email = "unconfigured";
      }
      continue;
    }
    email = "unconfigured";
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
