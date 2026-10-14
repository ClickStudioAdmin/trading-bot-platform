# 2FA

**V1 item 2** ([roadmap.md](roadmap.md)). Spec written 16 Sep 2026 when Click split this out of entitlements. Identity (verify + forgot password) is V1 item 1. Plan-required 2FA and Upgrade gates are V1 item 6 ([phase-entitlements.md](phase-entitlements.md)).

**Accepted 17 Sep 2026** for sign-in. Step-up on the submits below was added 14 Oct 2026. The plan checkbox `requires_2fa` is still not wired.

Never trust the browser. Server actions reject. Secrets never go in `NEXT_PUBLIC_` or the frontend bundle beyond the enroll QR the signed-in member asked for.

## Status

Accepted 17 Sep 2026 for sign-in. Google Authenticator TOTP on Account Settings → Password & Security. Sign-in asks for the 6-digit code (or a one-time recovery code) on its own page. When that authenticator is already on, the submits listed under Step-up open a modal for a fresh code. Cancel closes the modal and does not submit. Those pages do not show the code field. A login with 2FA off is unchanged. Not a plan gate.

## Purpose

A member can turn on **Google Authenticator** (standard TOTP: SHA-1, 6 digits, 30s) on Account Settings → Password & Security. After that, sign-in asks for the code on its own page. The same code is asked again in a modal when a step-up submit in Done when is clicked. A plan **requiring** 2FA before Live / copy / backtest is **not** this item.

## Done when

1. Account Settings → Password & Security can enable **Google Authenticator**. Recovery codes shown **once**. Secrets encrypted at rest with the same class of key as other credentials. Recovery codes are hashed.
2. Sign-in: email + password, then the code when 2FA is on. Recovery code works as a one-time fallback and is consumed.
3. Disable 2FA requires the current password (and the current code if still enrolled).
4. Unverified logins stay on the verify wall — they cannot reach Settings to enroll.
5. Server rejects a session that skipped the 2FA step.
6. When 2FA is already on, these submits reject without a current authenticator or recovery code: change password, Account Balance withdraw, save affiliate payout address, request an affiliate payout, save or replace an exchange API key (including setup), rotate a webhook secret, delete a desk, change the public trader alias, and reset the develop account. The action button opens that code in a modal. A small Cancel drops the request and leaves the page as it was. Bio, logo, and an unchanged alias do not ask. Pause, close, billing, and sign-in stay on the session. Sign-in keeps its dedicated page.

The plan checkbox that requires enrollment before other clicks is still V1 item 6. Do not add that here.

## Out of scope

- Plan-required 2FA (V1 item 6)
- SMS, passkeys, WebAuthn (V2)
- Change-email (V2)

## After this

V1 item 3 is UI refinement. V1 item 4 is account Positions / Bots / Automations lists ([phase-account-blotter.md](phase-account-blotter.md)). V1 item 5 is onboarding ([phase-onboarding.md](phase-onboarding.md)). V1 item 6 is entitlements and plan / 2FA gates.
