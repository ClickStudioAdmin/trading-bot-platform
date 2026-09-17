import {
  appBaseUrl,
  escapeNoticeHtml,
  noticeAbsoluteHref,
  noticeEmailHtml,
  noticeEmailText,
  sendResendEmail,
} from "@/lib/notifications/email";
import { resolvePlatformEmailFrom } from "@/lib/notifications/email-from";
import type { NotificationNotice } from "@/lib/notifications/copy";

export const AUTH_EMAIL_FOOTER =
  "If you did not ask for this, you can ignore the email.";

export const AUTH_MAIL_ALWAYS_OK =
  "If that login exists, we sent a link.";

export function verifyEmailNotice(token: string): NotificationNotice {
  return {
    subject: "Confirm your email",
    paragraphs: [
      "We received a signup for this address. Click the button to confirm it.",
      "The link expires in 24 hours.",
    ],
    actionLabel: "Confirm email",
    actionUrl: `/verify-email?token=${encodeURIComponent(token)}`,
  };
}

export function resetPasswordNotice(token: string): NotificationNotice {
  return {
    subject: "Reset your password",
    paragraphs: [
      "We received a request to reset the password for this login.",
      "The link expires in 1 hour.",
    ],
    actionLabel: "Choose a new password",
    actionUrl: `/reset-password?token=${encodeURIComponent(token)}`,
  };
}

export function authEmailHref(actionUrl: string, baseUrl = appBaseUrl()): string {
  return noticeAbsoluteHref(actionUrl, baseUrl);
}

export function renderAuthEmail(notice: NotificationNotice, actionHref: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: notice.subject,
    html: noticeEmailHtml(notice, {
      footer: AUTH_EMAIL_FOOTER,
      actionHref,
    }),
    text: noticeEmailText(notice, {
      footer: AUTH_EMAIL_FOOTER,
      actionHref,
    }),
  };
}

export async function sendAuthEmail(input: {
  to: string;
  notice: NotificationNotice;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const href = authEmailHref(input.notice.actionUrl);
  const rendered = renderAuthEmail(input.notice, href);
  const from = await resolvePlatformEmailFrom();
  return sendResendEmail(
    {
      to: input.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    },
    {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: from,
    },
  );
}

export { escapeNoticeHtml };
