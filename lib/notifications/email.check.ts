import assert from "node:assert/strict";
import { notificationCopy } from "./copy";
import {
  MEMBER_EMAIL_FOOTER,
  NOTICE_EMAIL_PAGE,
  NOTICE_EMAIL_WIDTH_PX,
  appBaseUrl,
  escapeNoticeHtml,
  noticeAbsoluteHref,
  noticeEmailHtml,
  noticeEmailText,
  sendResendEmail,
} from "./email";

assert.equal(appBaseUrl({ APP_BASE_URL: "https://app.example/" }), "https://app.example");
assert.equal(
  noticeAbsoluteHref("/account/billing", "https://app.example"),
  "https://app.example/account/billing",
);
assert.equal(
  noticeAbsoluteHref("https://evil.example/phish", "https://app.example"),
  "https://app.example/account/notifications",
);
assert.equal(noticeAbsoluteHref("/account/settings", ""), "/account/settings");
assert.equal(escapeNoticeHtml(`<x & "y">`), "&lt;x &amp; &quot;y&quot;&gt;");

const notice = notificationCopy.password_changed();
const href = noticeAbsoluteHref(notice.actionUrl, "https://app.example");
const html = noticeEmailHtml(notice, {
  footer: MEMBER_EMAIL_FOOTER,
  actionHref: href,
  baseUrl: "https://app.example",
});
assert.match(html, /Your password was changed/);
assert.match(html, /Account settings/);
assert.match(html, /https:\/\/app\.example\/account\/settings/);
assert.match(html, /modify your email preferences/);
assert.match(
  html,
  /https:\/\/app\.example\/account\/settings\?tab=notifications/,
);
assert.match(html, />Notifications<\/a>/);
assert.match(html, /#ffffff/);
assert.match(html, new RegExp(NOTICE_EMAIL_PAGE));
assert.match(html, new RegExp(`width="${NOTICE_EMAIL_WIDTH_PX}"`));
assert.match(html, /Trading Bot Platform/);
assert.match(
  noticeEmailHtml(notice, {
    actionHref: href,
    brand: "Alpha Desks",
  }),
  /Alpha Desks/,
);
assert.equal(html.includes("<script>"), false);
assert.match(
  noticeEmailHtml(
    { ...notice, subject: `<img src=x onerror=alert(1)>` },
    { actionHref: href },
  ),
  /&lt;img src=x onerror=alert\(1\)&gt;/,
);

const operator = notificationCopy.operator_gas_low({
  chain: "Arbitrum Sepolia",
  balanceEth: "0.001",
  thresholdEth: "0.005",
});
const operatorHtml = noticeEmailHtml(operator, {
  actionHref: noticeAbsoluteHref(operator.actionUrl, "https://app.example"),
});
assert.equal(operatorHtml.includes(MEMBER_EMAIL_FOOTER), false);
assert.match(operatorHtml, /Gas wallet low/);

const text = noticeEmailText(notice, {
  footer: MEMBER_EMAIL_FOOTER,
  actionHref: href,
});
assert.match(text, /Your password was changed/);
assert.match(text, /Account settings: https:\/\/app\.example\/account\/settings/);
assert.match(text, /Account Settings → Notifications/);

async function main(): Promise<void> {
  const unconfigured = await sendResendEmail(
    { to: "a@b.com", subject: "x", html: "<p>x</p>", text: "x" },
    { RESEND_API_KEY: "", EMAIL_FROM: "TBP <a@b.com>" },
    async () => {
      throw new Error("should not fetch");
    },
  );
  assert.deepEqual(unconfigured, { ok: false, error: "unconfigured" });

  const sent = await sendResendEmail(
    { to: "a@b.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi" },
    { RESEND_API_KEY: "rk", EMAIL_FROM: "TBP <a@b.com>" },
    async (url, init) => {
      assert.equal(url, "https://api.resend.com/emails");
      const request = init as RequestInit;
      assert.equal(request.method, "POST");
      const headers = request.headers as Record<string, string>;
      assert.equal(headers.Authorization, "Bearer rk");
      const body = JSON.parse(String(request.body));
      assert.equal(body.from, "TBP <a@b.com>");
      assert.deepEqual(body.to, ["a@b.com"]);
      assert.equal(body.subject, "Hello");
      return new Response("{}", { status: 200 });
    },
  );
  assert.deepEqual(sent, { ok: true });

  const failed = await sendResendEmail(
    { to: "a@b.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi" },
    { RESEND_API_KEY: "rk", EMAIL_FROM: "TBP <a@b.com>" },
    async () => new Response("nope", { status: 401 }),
  );
  assert.deepEqual(failed, { ok: false, error: "nope" });

  console.log("notification email checks passed");
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
