import { DEFAULT_PLATFORM_NAME } from "@/lib/platform/brand";
import { safeNoticeHref } from "./hrefs";
import type { NotificationNotice } from "./copy";

export const MEMBER_NOTIFICATIONS_PATH = "/account/settings?tab=notifications";
export const MEMBER_EMAIL_FOOTER =
  "You can modify your email preferences on Account Settings → Notifications.";

const PAGE = "#f4f6f8";
const CARD = "#ffffff";
const LINE = "#e5e7eb";
const INK = "#111827";
const INK_MUTED = "#4b5563";
const INK_FAINT = "#6b7280";
const ACCENT_STRONG = "#8b6cf6";
const ON_ACCENT = "#ffffff";

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

function memberFooterHtml(footer: string, baseUrl?: string): string {
  if (footer !== MEMBER_EMAIL_FOOTER) {
    return escapeNoticeHtml(footer);
  }
  const href = noticeAbsoluteHref(
    MEMBER_NOTIFICATIONS_PATH,
    baseUrl ?? appBaseUrl(),
  );
  return `You can modify your email preferences on Account Settings → <a href="${escapeNoticeHtml(href)}" style="color:${ACCENT_STRONG};text-decoration:underline;">Notifications</a>.`;
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
  input: {
    footer?: string;
    actionHref: string;
    logoUrl?: string | null;
    brand?: string;
    baseUrl?: string;
  },
): string {
  const paragraphs = notice.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:${INK_MUTED}">${escapeNoticeHtml(paragraph)}</p>`,
    )
    .join("");
  const footer = input.footer
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.4;color:${INK_FAINT}">${memberFooterHtml(input.footer, input.baseUrl)}</p>`
    : "";
  const brand = escapeNoticeHtml(input.brand?.trim() || DEFAULT_PLATFORM_NAME);
  const logo = input.logoUrl
    ? `<img src="${escapeNoticeHtml(input.logoUrl)}" alt="${brand}" width="96" style="display:block;max-width:96px;height:auto;margin:0 0 12px;border:0;" />`
    : "";
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:${PAGE};color:${INK};font-family:ui-sans-serif,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:${CARD};border:1px solid ${LINE};border-radius:16px;">
          <tr>
            <td style="padding:20px;">
              ${logo}
              <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${INK_FAINT}">${brand}</p>
              <h1 style="margin:12px 0 0;font-size:18px;line-height:1.3;color:${INK}">${escapeNoticeHtml(notice.subject)}</h1>
              ${paragraphs}
              <p style="margin:16px 0 0;">
                <a href="${escapeNoticeHtml(input.actionHref)}" style="display:inline-block;background:${ACCENT_STRONG};color:${ON_ACCENT};text-decoration:none;padding:8px 12px;border-radius:8px;font-size:14px;font-weight:500;">${escapeNoticeHtml(notice.actionLabel)}</a>
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
