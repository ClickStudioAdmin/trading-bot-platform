# 2FA (login only)

**V1 item 2** ([roadmap.md](roadmap.md)). Spec written 16 Sep 2026 when Click split this out of entitlements. Identity (verify + forgot password) is V1 item 1. Plan-required 2FA and Upgrade gates are V1 item 4 ([phase-entitlements.md](phase-entitlements.md)).

**Accepted 17 Sep 2026.** Stop. Do not start UI cleanup or plan gates until Click says go.

Never trust the browser. Server actions reject. Secrets never go in `NEXT_PUBLIC_` or the frontend bundle beyond the enroll QR the signed-in member asked for.

## Status

Accepted 17 Sep 2026. Google Authenticator TOTP on Account Settings → Password & Security. Sign-in asks for the 6-digit code (or a one-time recovery code). Not a plan gate.

## Purpose

A member can turn on **Google Authenticator** (standard TOTP: SHA-1, 6 digits, 30s) on Account Settings → Password & Security. After that, sign-in asks for the code. That is the whole item. A plan **requiring** 2FA before Live / copy / backtest is **not** this item.

## Done when

1. Account Settings → Password & Security can enable **Google Authenticator**. Recovery codes shown **once**. Secrets encrypted at rest with the same class of key as other credentials. Recovery codes are hashed.
2. Sign-in: email + password, then the code when 2FA is on. Recovery code works as a one-time fallback and is consumed.
3. Disable 2FA requires the current password (and the current code if still enrolled).
4. Unverified logins stay on the verify wall — they cannot reach Settings to enroll.
5. Server rejects a session that skipped the 2FA step.

Stop. Do not add plan flags, Upgrade copy, or “turn on 2FA to unlock Live” here.

## Out of scope

- Plan-required 2FA (V1 item 4)
- SMS, passkeys, WebAuthn (V2)
- Change-email (V2)

## After this

V1 item 3 is UI refinement. V1 item 4 is entitlements and plan / 2FA gates.
