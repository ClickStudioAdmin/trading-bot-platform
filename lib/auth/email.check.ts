import assert from "node:assert/strict";
import {
  AUTH_EMAIL_FOOTER,
  AUTH_MAIL_ALWAYS_OK,
  authEmailHref,
  renderAuthEmail,
  resetPasswordNotice,
  verifyEmailNotice,
} from "./email";

assert.match(AUTH_MAIL_ALWAYS_OK, /If that login exists/);

const verify = verifyEmailNotice("tok+en");
assert.equal(verify.subject, "Confirm your email");
assert.equal(verify.actionUrl, "/verify-email?token=tok%2Ben");
assert.equal(
  authEmailHref(verify.actionUrl, "https://app.example"),
  "https://app.example/verify-email?token=tok%2Ben",
);

const reset = resetPasswordNotice("abc");
assert.equal(reset.actionUrl, "/reset-password?token=abc");

const html = renderAuthEmail(
  verify,
  "https://app.example/verify-email?token=tok%2Ben",
).html;
assert.match(html, /Confirm your email/);
assert.match(html, /https:\/\/app\.example\/verify-email\?token=tok%2Ben/);
assert.match(html, /If you did not ask for this/);
assert.equal(html.includes("Account Settings → Notifications"), false);
assert.equal(html.includes("<script>"), false);
assert.match(AUTH_EMAIL_FOOTER, /ignore the email/);

const text = renderAuthEmail(
  reset,
  "https://app.example/reset-password?token=abc",
).text;
assert.match(text, /Reset your password/);
assert.match(text, /Choose a new password: https:\/\/app\.example\/reset-password\?token=abc/);

console.log("auth email checks passed");
