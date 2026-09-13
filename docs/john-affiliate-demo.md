# John affiliate demo data

Develop seed so Click can see populated affiliate tables, the network chart, and the admin payout queue.

**Not production data.** Migration `supabase/migrations/20260913160000_john_affiliate_demo.sql` applies on push to `develop`. Do not merge it to `main` until the rows are cleared (or add a follow-up migration that calls `clear_john_affiliate_demo()`).

## How it lands

GitHub Actions on `develop` runs the migration. It is idempotent: if any `@tbp-john-demo.invalid` member already exists, it skips.

Emails are deterministic (`john.1-2@tbp-john-demo.invalid`). User ids are `md5('tbp-john-demo:' || path)::uuid`.

## Who they are

- First name **John**. Display name / alias is `John 1-3-5` (path in the tree).
- Email `john.{path}@tbp-john-demo.invalid` (example `john.1-2@tbp-john-demo.invalid`).
- Password **`55555555`** for every John. Sign-in requires 8 characters, so this is eight 5s (not six).
- Hung under the first active **admin** login (`click.studio.admin@gmail.com` when present).
- Full **5×5** tree: five direct referrals under the admin and under every John, five levels deep (**3,905** Johns).

Cleanup matches the `@tbp-john-demo.invalid` email domain, `John demo` campaigns, `JDEM*` links, and `john-demo:` payout / invoice ids.

## What else is seeded

- Mix of paid Plus members, Free signups, and affiliate-only Johns.
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
