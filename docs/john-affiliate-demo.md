# John affiliate demo data

Develop seed so Click can see populated affiliate tables, the network chart, and the admin payout queue.

**Not production data.** Migration `supabase/migrations/20260913160000_john_affiliate_demo.sql` applies on push to `develop`. Do not merge it to `main` until the rows are cleared (or add a follow-up migration that calls `clear_john_affiliate_demo()`).

## How it lands

GitHub Actions on `develop` runs the migration. It is idempotent: if any `@tbp-john-demo.invalid` member already exists, it skips.

Emails are deterministic (`john.1-2@tbp-john-demo.invalid`). User ids are `md5('tbp-john-demo:' || path)::uuid`.

## Who they are

- Login name and trader alias stay `John {path}`. **Affiliate alias** is a unique first + last name (for example `Ava Walker`) on `members.affiliate_alias`. Emails stay `john.{path}@tbp-john-demo.invalid`.
- Password **`55555555`** for every John. Sign-in requires 8 characters, so this is eight 5s (not six).
- Hung under the first active **admin** login (`click.studio.admin@gmail.com` when present).
- Full **5×5** tree: five direct referrals under the admin and under every John, five levels deep (**3,905** Johns).
- Every John is a paid platform member on **Pro** or **Premium** (Premium if that plan exists). Follow-up migrations `20260914090000_john_demo_aliases_and_plans.sql` (plans) and `20260914110000_john_demo_affiliate_aliases.sql` (affiliate aliases).

Cleanup matches the `@tbp-john-demo.invalid` email domain, `John demo` campaigns, `JDEM*` links, and `john-demo:` payout / invoice ids.

## What else is seeded

- All Johns paid on Pro or Premium so network MRR and conversion look full.
- Unique first + last **affiliate aliases** (network labels). Trader aliases stay `John {path}`.
- Admin campaigns / custom links (including one archived each).
- Commissions in **pending**, **payable**, **paid**, and **void**.
- Payouts in **requested**, **approved**, **rejected**, and **paid** (admin queue + a few John portals).
- Program max depth set to **5** so the tree is visible. Default L1–L5 rates are filled in only if they were all zero.

## Remove

In the develop Supabase SQL editor:

```
select public.clear_john_affiliate_demo();
```

That function ships in the same migration. It does not restore the previous max-depth / default-rate settings.
