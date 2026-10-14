# Identity, entitlements, and plan gates

Identity is **V1 item 1**. Plan / 2FA gates are **V1 item 6**. Optional login 2FA is its own item: [phase-2fa.md](phase-2fa.md) (V1 item 2). Account blotter lists are V1 item 4 ([phase-account-blotter.md](phase-account-blotter.md)). Onboarding is V1 item 5 ([phase-onboarding.md](phase-onboarding.md)). Locked order: [roadmap.md](roadmap.md).

Membership billing, wallets, and affiliates stay [phase-membership.md](phase-membership.md) (shipped). Admin roles are V2 ([phase-admin-roles.md](phase-admin-roles.md)). The first-desk `/welcome` wizard was removed in identity; new users land on Overview after they verify.

Never trust the browser for entitlements, verification, 2FA, or admin permissions. Server actions reject.

## Status

**V1 item 1 (identity) accepted 17 Sep 2026:** verify on signup + forgot password + unverified wall. **V1 item 2 (2FA) accepted 17 Sep 2026:** Google Authenticator enroll + sign-in. **V1 item 3 accepted 21 Sep 2026.** Item 4 (account blotter lists) is current. Onboarding is V1 item 5 and Click is building that now. The gate map below was scoped **9 Oct 2026**. Click started 6a one row at a time on **14 Oct 2026**. Desk types, Paper Trading, Exchange Connected Demo, Exchange Connected Live, Max Bots, Save Templates, Share Templates, Import / Export Templates, Copy other Trader's Desks, Max Desk Copies, public and private desk sharing, and Max Followers per Desk are in. Inbound webhooks and Deduct Plan Payment from Earnings stay available on every plan where the product can use them, and are not gates. Do not start the next row until Click asks.

## Purpose

Prove the login (verified email; optional 2FA) then, in V1 item 6, gate product on the settled plan. Free can test; paid unlocks Live, copy, backtest, and higher caps. Surfaces stay **visible and disabled** with an **Upgrade** banner. A plan can require 2FA before those unlocks apply. The verify wall already covers email. After a downgrade, extras stay operable through admin grace, then the worker Close/Disables oldest desk first.

## V1 items this file covers

| V1 | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Email verification + forgot password | Agent | Signup (platform and affiliate) creates the login, signs them in, and mails a one-time verify link plus a 6-digit code. Unverified logins hit a **verify wall** (below). Public forgot-password mails a one-time reset link. Existing members are grandfathered verified. First-desk `/welcome` wizard removed; verified new users land on `/account`. **Accepted 17 Sep 2026.** Code entry added on the verify wall after that acceptance. |
| 6a | Entitlements + Upgrade UX | Agent | `assertEntitlement` for every row on the plan editor. Controls stay visible and disable. **Upgrade** names the cheapest public plan. A plan may **Require 2FA**. Cap notice: “You have hit your maximum of 2 Paper Trading Desks. Upgrade to Plus to add another.” Server actions reject. Matrix is below. Stop. |
| 6b | Downgrade grace | Agent | Entitlements change at period end. Admin grace days (default 7, already saved on `/admin/settings` Affiliates). Banner + operable extras. After grace, billing worker Close/Disable **oldest desk first**: forbidden features, then numeric caps. Upgrade during grace cancels the sweep. Ledgers stay. Stop. |
| 6c | Desk test | Click | Free gates visible/disabled. A plan that requires 2FA. Upgrade Stripe test. Crypto top-up + leftover debit. Affiliate list/chart/stats. Hold then withdraw. Downgrade grace then oldest-first exit. Archive a used plan (cannot delete). |

2FA enroll + sign-in only is [phase-2fa.md](phase-2fa.md), not a row here. Stop after each V1 item until Click says go.

## How it works

### Identity (V1 item 1 — in repo)

TBP already has email/password on `members` and a signed session cookie. There is no Supabase Auth. Keep that. Add proof of inbox, then a public reset path.

**Auth mail is not the inbox catalog.** Verify and reset links never write `user_notifications` and are not muteable. They use the same Resend + `NoticeEmail` layout and `APP_BASE_URL`. If Resend is unset, send no-ops (develop can still click a logged or admin-shown link only if we add a develop-only resend on `/account/verify` — no token in the browser by default). `password_changed` still fires after a successful reset or signed-in change.

#### Email verify on signup

1. Public `/sign-up` and affiliate `/affiliates` signup stay as they are: create the row, hash the password, create the session.
2. New rows have `email_verified_at` null.
3. Send a one-time link and a 6-digit code to that address. The link is `{APP_BASE_URL}/verify-email?token=…`. The code is entered on `/account/verify`.
4. Land them on `/account/verify` (“Check your email”), not Overview and not the affiliate portal.
5. Later sign-in with an unverified login also lands on `/account/verify`. Password can still be used to sign in — we do not lock them out of the session.
6. The mail link opens `/verify-email?token=` and asks them to click **Confirm email** (mail scanners cannot consume the token). That sets `email_verified_at`, consumes the token, then sends them on: `/account` if they have no desk, else desk home; affiliate-only to `/affiliates`.
7. On `/account/verify` they can paste or type the same code and click **Confirm email**. Same result as the link. The code is checked only for that signed-in login. Five wrong codes lock further guesses; the link in that mail still works. A resend replaces both.
8. Resend from `/account/verify` (rate-limited). Same always-ok copy if we add a public “didn’t get it” later.

**Tokens.** Table `member_email_tokens`: `id`, `user_id`, `purpose` (`verify` | `reset`), `token_hash`, `code_hash` (verify only), `code_attempts`, `expires_at`, `used_at`. Store SHA-256 of the link secret and of the code, never the raw values. Verify link and code last **24 hours**. One unused token per user+purpose — a resend replaces the old one and issues a new code. Service-role only. Never `NEXT_PUBLIC_`.

**Who is already verified**

- Migration: existing `members` get `email_verified_at = created_at` so current logins are not walled.
- Admin-created members: verified at create (admin typed the address). Admin can still force a re-verify later if we add that control; not this step.
- Listed owner first-login bootstrap: verified when the row is created.

#### Forgot password

Public pages, no session required.

1. `/forgot-password` — email only. Always “If that login exists, we sent a link.” Do not reveal whether the email is known.
2. Mail a one-time link `{APP_BASE_URL}/reset-password?token=…` (**1 hour**). Same token table, purpose `reset`.
3. `/reset-password` — new password + confirm. Invalid/expired token shows a generic fail and a link back to forgot.
4. On success: set the hash, mark `email_verified_at` (they proved the inbox), consume the token, fire `password_changed`, send them to `/sign-in`. Do not auto-create a session from the token alone after reset (they sign in with the new password).
5. Rate-limit sends (about one per 2 minutes per email). Same always-ok copy.

**Signed-in password change** (same step, Settings → Password): current password + new password. Apply immediately as today, then `password_changed`. A second confirm-before-apply mail is **not** this slice — forgot-password covers a lost inbox. Unverified users cannot reach Settings to change password (they are on the wall).

#### Verify wall (how they are restricted)

Until `email_verified_at` is set, the login is signed in but **cannot use the product**. Same rule for platform and affiliate-only.

**Allowed**

- `/account/verify` (status, resend)
- `/verify-email` (consume the link)
- `/forgot-password`, `/reset-password`
- `/sign-in`, `/sign-up`, `/sign-out`
- Public marketing (`/`, `/pricing`, `/r/…`)
- Session cookie / sign-out

**Blocked** (redirect to `/account/verify`; server actions reject)

- Desk create and every desk route (Positions, Automations, Activity, …)
- `/account/*` except verify (Overview, Inbox, Settings, Billing, Exchanges, Copy, Backtests)
- `/affiliates` portal after the public sell page — an unverified affiliate-only login does not get the dashboard, payouts, or settings
- `/admin/*`
- Tick, webhooks, engine actions as that user (they have no desk yet on a fresh signup; existing grandfathered users are already verified)

UI may show the verify page only — do not leave gated desk chrome visible “disabled” for this wall. That Upgrade-and-disable pattern is for plan gates in V1 item 6. This wall is “prove the inbox first.”

Never trust the browser. `requireVerifiedEmail()` on every mutating server action that is not verify/resend/sign-out.

#### Out of this slice

- Change-email flow (V2)
- 2FA enroll + sign-in ([phase-2fa.md](phase-2fa.md), V1 item 2) — in repo 17 Sep 2026
- `assertEntitlement` / Upgrade banners (V1 item 6)
- Downgrade grace (V1 item 6)
- Onboarding wizard (V1 item 5)

### Gates (scoped 9 Oct 2026 — do not build until Click says go)

Step **6a** is the product gates. Step **6b** is grace and the auto-exit. Stop after 6a. Billing, wallets, and affiliates stay as shipped in [phase-membership.md](phase-membership.md).

The plan editor and `/account/plans` already persist `features` and `caps` through `lib/membership/catalog.ts`. Nothing in the app reads those flags except affiliate earn depth and **Deduct Plan Payment from Earnings**. This step is the read path: one server check, then disable the control that would have called it.

#### Rules that stay

- UI **never hides** a gated surface. The nav item, page, and control stay. The control is disabled. A persistent **Upgrade** banner, and the same line on the control, names the cheapest public plan that unlocks it.
- A cap does not hide Create. Copy is “You have hit your maximum of 2 Paper Trading Desks. Upgrade to Plus to add another.” Use the cap label from the catalog. Unlimited (`null`) never trips. A cap of 0 uses the not-allowed line: “Exchange Connected - Live desks are not allowed on your plan. Upgrade to Plus to enable it.”
- Server actions reject with that same sentence. The browser is not the check.
- The verify wall already blocks an unverified login. Do not add a second email wall and do not let a plan flag turn the wall off.
- In-app banner only. Do not add plan-limit notification templates in 6a.
- Admin `/admin/*` stays role-based. Never a plan flag.
- Comp and `past_due` use the current `plan_id` until `period_end`. 6a does not schedule downgrades.

#### What is a gate

Gates are the rows on the plan editor (`PLAN_COMPARE_SECTIONS`). A key that is not on that editor is not a gate, even if it is still stored on old plan JSON.

| Stored key | Why it is not a 6a gate |
| --- | --- |
| `mode_paper`, `mode_live` | Paper, Demo, and Live are the three desk caps. |
| `venue_non_bybit` | Not on the editor. Hyperliquid is not a plan gate in this step. |
| `desk_scale_in` | That desk type does not exist. |
| `extras_advanced_dca` | Off the public catalog. Confirm, Exit-if, and ATR stay as they are. |
| `affiliate_enroll` | Every login is an affiliate. |
| Chart, Starter Pack apply | Not plan features. |

`affiliate_max_depth` is already applied in `resolveEarnDepth`. Leave commission math alone. `affiliate_pay_subscription` is already applied when rent is collected. Inbound webhooks (`signals_inbound_webhooks`) and Deduct Plan Payment from Earnings stay available on every plan where that action is possible. 6a does not gate webhook create, a webhook start, or the Billing opt-in.

#### Settled plan and the check

`assertEntitlement` lives in `lib/membership/entitlements.ts` with `entitlements.check.ts`. The pure function takes the plan, the member’s 2FA flag, and the counts for this action. It does not touch the database. A server helper loads `plan_id`, the plan row, and the counts, then calls it. Mutations call the helper after `requireVerifiedEmail()`.

Result is allow, or a reason:

- `upgrade` — feature off, or cap already used up. Name the cheapest **public**, not archived plan (lowest price, then `sort_order`) where the feature is on, or where the cap is null or greater than current use. A private plan is never named. If no public plan unlocks it, the line says it is not on a public plan and does not invent a name.
- `need_2fa` — the plan has **Require 2FA** and `totp_enabled_at` is null. Copy is “Turn on 2FA”, linking to Account Settings → Password & Security. Not checkout.

**Require 2FA** is a boolean on `membership_plans` (`requires_2fa`, default false), not a catalog tick. Admin plan editor gets one checkbox. Seed every existing plan false so current logins are not blocked. It applies to the mutations in the matrix below. It does not apply to billing, settings, sign-in, or sign-out.

Editing an existing bot, template, listing, or backtest does not consume another cap. Creating, cloning, importing, queueing, and arming a new one does.

#### Feature trials

Admin can put a free trial on the right of each plan-editor row. A checkbox row gets a **Free trial** tick and a day count (1–365). A cap gets the same tick, a **trial limit** (higher than the standing cap), and the same day count. The tick is what turns the trial on. Affiliate percents, Earning Depth, and Deduct Plan Payment from Earnings have no trial. A ticked feature is already included, so its trial is stored and unused. An unlimited cap cannot also have a trial limit.

`membership_plans.trials` holds that config. `member_feature_trials` holds one clock per login and row. The clock starts the first time Billing & Account or Plans loads while that row is a trial on the current plan. It does not restart if they leave the plan and come back, and changing the day count does not move an existing end. Plans show an open trial as a warning badge. A feature reads like 14 Day Trial. A cap shows the trial limit, such as 2 or 1 Year. Billing & Account shows the row as temporary (dashed warning) and reads like 14 day trial. Hover says the end date. On a plan they are not on, hover says the end date starts when that plan applies. A counted cap on Billing & Account stays grey. An orange warning icon sits beside that count once usage is within 10% of the cap. A privilege the plan does not include shows an em dash.

While the clock is open, 6a treats the feature as on and the cap as the trial limit. The disabled-control line is a trial line: “Backtesting Tool is in a free trial until {date}.” After `ends_at`, the initiate actions in the matrix reject: “Your free trial of {label} ended on {date}.” Saved work stays readable. A saved backtest and its existing replay stay open. Queue, attach, a new replay variant, and any other create in the matrix do not. The same split applies to every trialed row: open what they already have, refuse new work. Do not delete the trial rows or the work they produced.

#### Gate matrix (6a)

Desk display mode is already `deskDisplayMode` in `lib/accounts/model.ts`: paper; live with `demo` or `testnet` environment; otherwise live. Bybit create often stores a null environment until a key is bound. Count and reject using the environment chosen on the form, or the bound key’s environment when that is what the action writes. Binding a key that moves a desk from Demo to Live re-checks the Live cap and rejects the bind when it would go over.

Setup finish in `lib/onboarding/actions.ts` writes desks with `insertTradingAccount` and starter bots with `applyTemplateToDesk`. Those writes take the same type, mode-cap, and Max Bots checks as the desk form. The setup modal disables a type or mode the plan does not allow.

| Plan row | Reject when | Also disable |
| --- | --- | --- |
| Desk type tick (`desk_perps`, `desk_perps_bots`, `desk_dca`, `desk_cash_and_carry`, `desk_signal_follower`) | `createTradingAccount`, `createCopyDeskAction`, and setup finish for that type | Type choice in the setup wizard, on `/account/desks/new`, the sidenav create control, and Manage Desks. Copy stays visible and disables. Page stays. |
| Paper Trading `max_paper_desks` | New paper desk, including a paper copy desk, when the login already has that many paper desks | Paper choice on create. |
| Exchange Connected - Demo `max_demo_desks` | New demo/testnet desk, or a bind that makes a desk demo, when already at the cap | Demo track on create. |
| Exchange Connected - Live `max_live_env_desks` | New live-environment desk, or a bind that makes a desk live, when already at the cap | Live track on create. |
| Max Bots `max_bots` | A new `dca_playbooks`, `futures_automation_rules`, or `paper_rules` row on any desk this login owns. Clone and template-apply that insert a row count. Disabled rows still count until deleted | Create, Clone, and template apply on Automations. Save of an existing row stays enabled. |
| Save Templates `extras_templates` | `saveDcaAsTemplateAction`, `savePerpsAsTemplateAction`, `savePaperAsTemplateAction`, `createTemplateSetAction` | Click on Save as template or Add New Folder shows “Saving templates is not allowed on your plan.” The control stays. |
| Share Templates `extras_share_templates` | `shareTemplateAction`, `shareSetAction` | Click on Share shows “Sharing templates is not allowed on your plan.” |
| Import / Export Templates `extras_import_export_templates` | `importTemplateLibraryAction`, `exportTemplateLibraryAction` | Click on Import, Export, or Export all shows “Importing and exporting templates is not allowed on your plan.” |
| Inbound webhooks `signals_inbound_webhooks` | Not a gate. Webhook create and a webhook start stay available on every plan where the product can use them. | |
| Copy other Trader's Desks `copy_follow` | `createCopyDeskAction` | Copy stays. The click shows “Copying other traders' desks is not allowed on your plan.” and does not open the dialog. Pause, resume, and unfollow stay. |
| Max Desk Copies `max_copy_follows` | That same create once desks with `copy_of_account_id` already reach the cap. A maximum of 0 uses the copying line. If copying is off, this cap is not a second banner | The same Copy click. “You have hit your maximum of 2 Desk Copies.” One is “1 Desk Copy.” |
| Desk Sharing - Public `copy_catalogue` | `saveDeskCopyListingAction` while sharing stays on and visibility is public | Both choices stay. Save shows “Sharing a desk publicly is not allowed on your plan.” and does not save. Turning sharing off stays. |
| Desk Sharing - Private `copy_share` | That save while sharing stays on and visibility is private. If both share ticks are off, one line: “Sharing this desk is not allowed on your plan.” | Save shows “Sharing a desk privately is not allowed on your plan.” |
| Max Followers per Desk `max_followers_accepted` | Saving a maximum above the plan, or inviting once invited and active followers reach it. Empty means unlimited. A maximum of 0 says “Followers are not allowed on your plan.” When both share ticks are off, this cap is not a second banner. A new follow whose owner no longer has that visibility, or whose owner is at this cap, fails for the copier with “This desk is not taking new followers.” | Maximum copy traders and Send invite. Revoke stays. Listings already shared keep working until 6b. |
| Backtesting Tool `research_backtest` | `queueTemplateBacktestAction` and any other member queue | Queue on New Backtest. `/account/backtests` stays, with the banner. The header link stays. |
| Attach Results to Bot Template `research_backtest_attach_templates` | Member `saveBacktestAsTemplateAction`. Admin platform-template save is not gated | Attach on the run. |
| Max Saved Backtests `max_stored_backtests` | Queue when this login’s `backtest_runs` already reach the cap | Queue. |
| Max Backtest Timeframe `max_backtest_years` | Queue whose date range is longer than that many years | The date fields show the limit; submit still rejects. |
| Replay Backtests `replay_backtests` | Opening `/account/backtests/[runId]/replay` | Replay on the runs table and the run page. The report stays. Replay also stays disabled when Backtesting Tool is off. |
| Add Additional Chart Indicators `replay_chart_indicators` | Saving extra replay chart indicators (`replay-chart-bar` add). Indicators the recipe already uses stay | Add indicator. |
| Strategy Optimization `replay_strategy_optimization` | Any member control that queues a replay variant or Modify run | That control, if it is already on the page. Do not build the parked optimizer ([phase-backtest-optimize.md](phase-backtest-optimize.md)). |
| Deduct Plan Payment from Earnings `affiliate_pay_subscription` | Not a gate. The Billing opt-in stays available wherever collection can run. Collection still refuses the transfer when the tick is off. | |

Desk types are the first row, started 14 Oct 2026. A type the plan does not include stays visible and disables. The line is “DCA desks are not allowed on your plan. Upgrade to Plus to enable it.” On a page, that line is a warning banner at the top, with a warning icon and an Upgrade button when a public plan is named. The button reads “Upgrade to Plus” and the banner lead drops the repeated “Upgrade to Plus to enable it.” An ended trial keeps its full sentence and still shows the button. The plan name is the cheapest public plan with that tick. A private plan is never named. If no public plan includes it, the line stops after “your plan.” An open trial keeps the type enabled: “DCA is in a free trial until {date}.” After the trial, a new desk of that type rejects with “Your free trial of DCA ended on {date}.” Desks already created stay. “Add a Paper Trading desk for each strategy type” adds only allowed types. A desk-type trial clock also starts the first time this gate loads, so setup can show the end date. Paper, Demo, Live, and Max Bots use the same banner. The cap line is “You have hit your maximum of 2 Paper Trading Desks. Upgrade to Plus to add another.” One is singular (“1 Exchange Connected - Demo Desk”). Demo reads “Exchange Connected - Demo Desks.” Live reads “Exchange Connected - Live Desks.” Bots read “You have hit your maximum of 4 Bots.” The button is “Upgrade to Plus” and the lead drops “Upgrade to Plus to add another.” A cap of 0 uses that same not-allowed line, for example “Exchange Connected - Live desks are not allowed on your plan. Upgrade to Plus to enable it.” Unlimited never trips. An open trial raises the cap to the trial limit: “Paper Trading is in a free trial until {date}.” After it ends, a create that the standing cap refuses says “Your free trial of Paper Trading ended on {date}.” Those four trial clocks also start the first time this gate loads. Other trials still start on Billing & Account or Plans. Save Templates, Share Templates, and Import / Export Templates show the banner when the button is clicked. The click does not open the dialog or run the action. The lines are “Saving templates is not allowed on your plan.” “Sharing templates is not allowed on your plan.” and “Importing and exporting templates is not allowed on your plan.” On the template library the banner sits under the heading. On the bot form it sits above Save as template. An open trial leaves the button working: “Saving templates is in a free trial until {date}.” After it ends, the click says “Your free trial of saving templates ended on {date}.” Templates, shares, and files that already exist stay. Unshare, delete, apply, and importing a template someone shared with you stay available. The admin library is not gated. Those three trial clocks start the first time this gate loads. Copy other Trader's Desks, Max Desk Copies, public sharing, private sharing, and Max Followers per Desk use the same banner on the click. Copy stays on the catalogue and the desk page. Save share and Send invite stay. The click shows the banner and does not open the copy dialog, save that share choice, or send the invite. The lines are “Copying other traders' desks is not allowed on your plan.” “You have hit your maximum of 2 Desk Copies.” “Sharing a desk publicly is not allowed on your plan.” “Sharing a desk privately is not allowed on your plan.” When both share ticks are off, Save shows one line: “Sharing this desk is not allowed on your plan.” A maximum of 0 desk copies uses the copying line. A maximum of 0 followers says “Followers are not allowed on your plan.” One follower is “1 follower.” Empty maximum copy traders means unlimited and sits above a finite plan cap. Turning sharing off, revoke, pause, resume, and unfollow stay available. Copy desks and followers that already exist stay. An open trial leaves the control working: “Copying other traders' desks is in a free trial until {date}.” After it ends, the click says “Your free trial of copying other traders' desks ended on {date}.” A new follow of a listing whose owner no longer has that visibility, or whose owner is at the follower cap, fails for the copier with “This desk is not taking new followers.” The copier does not see the owner’s upgrade line. Those copy trial clocks start the first time this gate loads. Inbound webhooks and Deduct Plan Payment from Earnings are not gated.

Webhook deliveries and already-running bots are left alone in 6a. New creates reject. Cutting off a feature the member is already using is **6b**, after grace. Turning 6a on will reject **new** uses for anyone whose current plan does not include that row (seed Free has Live, copy, backtest, and webhooks off).

#### Tests (6a)

`entitlements.check.ts` covers the pure function: feature off, cap 0, cap exactly used, cap under the limit, null unlimited, edit-versus-create, 2FA required versus enrolled, cheapest public plan, private plan skipped, no public plan, hidden keys ignored. Desk-mode counts use the same `deskDisplayMode` cases already in `lib/accounts/model.check.ts`. No new dependency.

#### 6a done when

The matrix rejects on the server and the matching controls are disabled with Upgrade or Turn on 2FA. Billing checkout is unchanged. Stop. Click’s desk test is step 6c.

### Downgrade and over-quota (6b — after 6a is accepted)

Upgrade is immediate access. Downgrade entitlements change at **period end**, then grace (admin days on `/admin/settings` Affiliates, default **7**, already stored). 6a does not set `grace_until`. The column already exists and is unused.

During grace: banner lists what is over and the days left. Creates that would add another extra reject. Existing desks, bots, copy follows, webhooks, and backtests stay operable so the member can flatten. Upgrade clears `grace_until` and cancels the sweep.

There is no desk-disabled flag today. 6b adds one (`trading_accounts.disabled_at`) and teaches the engine tick to skip a disabled desk. Bots already have a disable path. Do not delete ledgers, fills, or history.

After grace, the billing worker (same engine cycle as invoices, after collect) walks **oldest desk first** (`created_at`):

1. Desks whose type, Live/Demo/Paper band, or copy follow is no longer allowed — cancel working orders, market-exit positions (`flattenLiveOpen` and the paper flatten), disable bots, set `disabled_at`.
2. Numeric caps — disable the oldest extras until `assertEntitlement` would pass. When only Max Bots is over, disable the oldest bot across the login and leave the desk enabled.

Engine ticks honour `disabled_at` and disabled bots. They do not grow a second ruleset.

## Out of scope

- Notifications product — already shipped. Admin roles are V2 ([phase-admin-roles.md](phase-admin-roles.md))
- Onboarding wizard (V1 item 5)
- Internal webhooks, scale-in, SMS 2FA, passkeys, WebAuthn, KYC (V2)

## After this

V1 item 2 is 2FA ([phase-2fa.md](phase-2fa.md)). V1 item 3 is UI cleanup. V1 item 4 is account Positions / Bots / Automations lists ([phase-account-blotter.md](phase-account-blotter.md)). V1 item 5 is onboarding ([phase-onboarding.md](phase-onboarding.md)). V1 item 6 is the gates in this file. See [roadmap.md](roadmap.md).
