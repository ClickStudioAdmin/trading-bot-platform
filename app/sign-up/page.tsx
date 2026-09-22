import type { Metadata } from "next";
import { namedPageMetadata } from "@/lib/platform/metadata";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { signUpMember } from "@/lib/auth/actions";
import { redirectSignedInHome } from "@/lib/auth/onboarding";
import { firstTouchReferralCode } from "@/lib/membership/affiliate";
import { readReferralCookie } from "@/lib/membership/affiliate-cookie";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";

export async function generateMetadata(): Promise<Metadata> {
  return namedPageMetadata(
    "Join for Free",
    (name) => `Create a Free membership on ${name}.`,
  );
}

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
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div>
          <PageHeading title="Join for Free" />
          <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
            It is free to open a platform account. Confirm your email, then
            create desks, paper trade on live marks, or bind a trade-only
            exchange key when you are ready. Upgrade later for more platform
            features and higher affiliate commissions. Every member is already
            an affiliate.
          </p>
          <ul className="mt-6 max-w-xl list-disc space-y-2 pl-5 text-sm text-ink-muted">
            <li>
              Paper uses public marks and the in-app ledger. Live binds a
              trade-only key from this login.
            </li>
            <li>
              Cash and Carry, Perps, Perps bots, TradingView Strategy, and DCA.
              Type is set at create.
            </li>
            <li>
              Share a referral code from day one. Commission is on membership
              subscriptions, not trading PnL.
            </li>
          </ul>
        </div>
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">
            Create a Free account
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Confirm your email to get started.
          </p>
          {error ? (
            <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <form action={signUpMember} className="mt-4 space-y-3">
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
              <span className="mt-1 block text-hint text-ink-muted">
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
              <span className="mt-1 block text-hint text-ink-muted">
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
            .
          </p>
        </section>
      </div>
    </main>
  );
}
