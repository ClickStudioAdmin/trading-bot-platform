import { safeNoticeHref } from "./hrefs";
import type { NotificationNotice } from "./copy";

export const MEMBER_EMAIL_FOOTER =
  "You can change these emails on Account Settings → Notifications.";

const CANVAS = "#0b0e14";
const LINE = "#2a313c";
const INK = "#f4f6f8";
const INK_MUTED = "#9aa3b2";
const INK_FAINT = "#6b7382";
const ACCENT_STRONG = "#8b6cf6";

export function appBaseUrl(
  env: { APP_BASE_URL?: string | undefined } = {
    APP_BASE_URL: process.env.APP_BASE_URL,
  },
): string {
  return String(env.APP_BASE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
}

export function noticeAbsoluteHref(
  actionUrl: string,
  baseUrl = appBaseUrl(),
): string {
  const path = safeNoticeHref(actionUrl);
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl}${path}`;
}

export function escapeNoticeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function noticeEmailText(
  notice: NotificationNotice,
  input: { footer?: string; actionHref: string },
): string {
  const lines = [
    notice.subject,
    "",
    ...notice.paragraphs,
    "",
    `${notice.actionLabel}: ${input.actionHref}`,
  ];
  if (input.footer) {
    lines.push("", input.footer);
  }
  return lines.join("\n");
}

export function noticeEmailHtml(
  notice: NotificationNotice,
  input: { footer?: string; actionHref: string },
): string {
  const paragraphs = notice.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:${INK_MUTED}">${escapeNoticeHtml(paragraph)}</p>`,
    )
    .join("");
  const footer = input.footer
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.4;color:${INK_FAINT}">${escapeNoticeHtml(input.footer)}</p>`
    : "";
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:${CANVAS};color:${INK};font-family:ui-sans-serif,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:${CANVAS};border:1px solid ${LINE};border-radius:16px;">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${INK_FAINT}">Trading Bot Platform</p>
              <h1 style="margin:12px 0 0;font-size:18px;line-height:1.3;color:${INK}">${escapeNoticeHtml(notice.subject)}</h1>
              ${paragraphs}
              <p style="margin:16px 0 0;">
                <a href="${escapeNoticeHtml(input.actionHref)}" style="display:inline-block;background:${ACCENT_STRONG};color:${INK};text-decoration:none;padding:8px 12px;border-radius:8px;font-size:14px;font-weight:500;">${escapeNoticeHtml(notice.actionLabel)}</a>
              </p>
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendResendEmail(
  input: { to: string; subject: string; html: string; text: string },
  env: { RESEND_API_KEY?: string | undefined; EMAIL_FROM?: string | undefined } = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  },
  post: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = String(env.RESEND_API_KEY ?? "").trim();
  const from = String(env.EMAIL_FROM ?? "").trim();
  if (!apiKey || !from) {
    return { ok: false, error: "unconfigured" };
  }
  try {
    const response = await post("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: body.slice(0, 200) || `http_${response.status}` };
    }
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "send_failed",
    };
  }
}
