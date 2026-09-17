import type { Metadata } from "next";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { signUpMember } from "@/lib/auth/actions";
import { redirectSignedInHome } from "@/lib/auth/onboarding";
import { firstTouchReferralCode } from "@/lib/membership/affiliate";
import { readReferralCookie } from "@/lib/membership/affiliate-cookie";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Join for Free",
  description: "Create a Free membership on Trading Bot Platform.",
};

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
      <h1 className="text-3xl font-semibold tracking-tight">Join for Free</h1>
      <p className="mt-3 text-sm text-ink-muted">
        Create a Free account and confirm your email to get started.
      </p>
      <section className="mt-8 rounded-card border border-line bg-surface p-5">
        {error ? (
          <p className="mb-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <form action={signUpMember} className="space-y-3">
          <label className="block text-sm text-ink" htmlFor="name">
            Name
            <input
              id="name"
              name="name"
              required
              maxLength={80}
              autoComplete="name"
              className={BILLING_FIELD_CLASS}
            />
          </label>
          <label className="block text-sm text-ink" htmlFor="email">
            Email
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={BILLING_FIELD_CLASS}
            />
          </label>
          <label className="block text-sm text-ink" htmlFor="password">
            Password
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={BILLING_FIELD_CLASS}
            />
            <span className="mt-1 block text-xs text-ink-muted">
              At least 8 characters.
            </span>
          </label>
          <label className="block text-sm text-ink" htmlFor="referralCode">
            Referral code
            <input
              id="referralCode"
              name="referralCode"
              defaultValue={referralCode}
              autoComplete="off"
              className={BILLING_FIELD_CLASS}
            />
            <span className="mt-1 block text-xs text-ink-muted">
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
        <p className="mt-4 text-sm text-ink-muted">
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
      </section>
    </main>
  );
}
