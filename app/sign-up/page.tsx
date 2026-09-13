import type { Metadata } from "next";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { signUpMember } from "@/lib/auth/actions";
import { redirectSignedInHome } from "@/lib/auth/onboarding";
import { firstTouchReferralCode } from "@/lib/membership/affiliate";
import { readReferralCookie } from "@/lib/membership/affiliate-cookie";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Start free",
  description: "Create a Free membership on Trading Bot Platform.",
};

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectSignedInHome();

  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const referralCode =
    firstTouchReferralCode(
      await readReferralCookie(),
      firstSearchValue(params.ref) ?? firstSearchValue(params.referralCode),
    ) ?? "";

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        Membership
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Start free</h1>
      <p className="mt-3 text-sm text-ink-muted">
        Create a Free account, then open your first desk. Upgrade later for
        Live, copy, backtest, or more desks. Every login is also an affiliate.
      </p>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <form action={signUpMember} className="mt-8 space-y-4">
        <label className="block text-xs text-ink-muted" htmlFor="name">
          Name
          <input
            id="name"
            name="name"
            required
            maxLength={80}
            autoComplete="name"
            className={fieldClass}
          />
        </label>
        <label className="block text-xs text-ink-muted" htmlFor="email">
          Email
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={fieldClass}
          />
        </label>
        <label className="block text-xs text-ink-muted" htmlFor="password">
          Password
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-ink-faint">
            At least 8 characters.
          </span>
        </label>
        <label className="block text-xs text-ink-muted" htmlFor="referralCode">
          Referral code
          <input
            id="referralCode"
            name="referralCode"
            defaultValue={referralCode}
            autoComplete="off"
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-ink-faint">
            Optional. Use a code if someone referred you.
          </span>
        </label>
        <PendingSubmitButton
          pendingLabel="Creating…"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Create free account
        </PendingSubmitButton>
      </form>
      <p className="mt-6 text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-accent hover:text-accent-strong">
          Sign in
        </Link>
        . Promote the platform without desks?{" "}
        <Link href="/affiliates" className="text-accent hover:text-accent-strong">
          Join as an affiliate
        </Link>
        .
      </p>
    </main>
  );
}
