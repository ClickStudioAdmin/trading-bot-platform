# John affiliate demo data

Local / develop seed so Click can see populated affiliate tables, the network chart, and the admin payout queue.

**Not production data.** Do not run against the production Supabase project.

## How to run

From the repo root, with `.env.local` pointed at **trading-bot-platform-dev**:

```
npx tsx scripts/john-affiliate-demo.ts seed
npx tsx scripts/john-affiliate-demo.ts clear
```

`seed` refuses if Johns already exist. `clear` then `seed` to rebuild.

## Who they are

- First name **John**. Display name / alias is `John 1-3-5` (path in the tree).
- Email `john.{path}@tbp-john-demo.invalid` (example `john.1-2@tbp-john-demo.invalid`).
- Password **`55555555`** for every John. Sign-in requires 8 characters, so this is eight 5s (not six).
- Hung under the first active **admin** login (`click.studio.admin@gmail.com` when present).
- Full **5×5** tree: five direct referrals under the admin and under every John, five levels deep (**3,905** Johns).

A written list is saved to `tmp/john-affiliate-demo.json` and `tmp/john-affiliate-demo.txt` after seed (gitignored). Cleanup also matches the `@tbp-john-demo.invalid` email domain, `John demo` campaigns, `JDEM*` links, and `john-demo:` payout / invoice ids.

## What else is seeded

- Mix of paid Plus members, Free signups, and affiliate-only Johns.
- Admin campaigns / custom links (including one archived each).
- Commissions in **pending**, **payable**, **paid**, and **void**.
- Payouts in **requested**, **approved**, **rejected**, and **paid** (admin queue + a few John portals).
- Program max depth set to **5** so the tree is visible. Default L1–L5 rates are filled in only if they were all zero. `clear` restores the previous settings.

## Remove

```
npx tsx scripts/john-affiliate-demo.ts clear
```
